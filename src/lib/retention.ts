import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { DEFAULT_FROM, sendOne, siteUrl, unsubscribeUrl } from "./resendSend";
import { abandonedCartEmail, lowStockEmail, restockEmail } from "./retentionEmails";

/* The automated customer emails, kept out of the admin route so the daily cron
 * and the admin's "Run now" button share exactly one implementation.
 *
 * House rule throughout: commit the state change that records "we handled
 * this" only after the send succeeds, but never let one recipient's failure
 * abort the rest of the run. Every function returns a summary instead of
 * throwing so a partial sweep still reports what it managed to do. */

export type SweepResult = { sent: number; skipped: number; errors: string[] };

const empty = (): SweepResult => ({ sent: 0, skipped: 0, errors: [] });

/** Sender address from site_settings, falling back to Resend's test sender. */
export async function resolveFrom(db: SupabaseClient): Promise<string> {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "email_from")
    .maybeSingle();
  return data?.value?.trim() || DEFAULT_FROM;
}

async function setting(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from("site_settings").select("value").eq("key", key).maybeSingle();
  return data?.value?.trim() || null;
}

/* ------------------------------------------------------------- back in stock */

/** Emails everyone waiting on these variants, if they now have stock. */
export async function notifyRestock(
  db: SupabaseClient,
  variantIds: number[]
): Promise<SweepResult> {
  const res = empty();
  if (!variantIds.length) return res;

  const { data: variants } = await db
    .from("variants")
    .select("id,title,stock,products(title,handle)")
    .in("id", variantIds);
  const inStock = (variants ?? []).filter((v) => v.stock > 0);
  if (!inStock.length) return res;

  const { data: requests } = await db
    .from("restock_requests")
    .select("id,variant_id,email")
    .in("variant_id", inStock.map((v) => v.id))
    .is("notified_at", null);
  if (!requests?.length) return res;

  const from = await resolveFrom(db);
  for (const r of requests) {
    const v = inStock.find((x) => x.id === r.variant_id);
    if (!v) continue;
    const product = v.products as unknown as { title: string; handle: string } | null;
    try {
      const mail = restockEmail({
        productTitle: product?.title ?? "A VDG piece",
        variantTitle: v.title,
        handle: product?.handle ?? "",
      });
      await sendOne({ from, to: r.email, ...mail });
      // only mark once the send actually succeeded, so a transient mail
      // outage means "try again tomorrow" rather than "silently dropped"
      await db.from("restock_requests").update({ notified_at: new Date().toISOString() }).eq("id", r.id);
      res.sent++;
    } catch (e) {
      res.errors.push(`${r.email}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }
  return res;
}

/* ----------------------------------------------------------------- low stock */

export async function lowStockSweep(db: SupabaseClient): Promise<SweepResult> {
  const res = empty();
  const threshold = Math.max(0, Number(await setting(db, "low_stock_threshold")) || 3);
  const to = (await setting(db, "low_stock_email")) || (await setting(db, "alert_email"));
  if (!to) {
    res.errors.push("No alert address set (Settings → Low stock).");
    return res;
  }

  const { data: variants } = await db
    .from("variants")
    .select("id,title,stock,low_stock_alerted_at,products(title,status)");

  // Anything comfortably restocked is eligible to alert again later; clearing
  // the marker here is what stops a permanently-low item nagging every day.
  const recovered = (variants ?? []).filter((v) => v.stock > threshold && v.low_stock_alerted_at);
  if (recovered.length) {
    await db
      .from("variants")
      .update({ low_stock_alerted_at: null })
      .in("id", recovered.map((v) => v.id));
  }

  const due = (variants ?? []).filter((v) => {
    const product = v.products as unknown as { status: string } | null;
    if (product?.status !== "active") return false; // drafts aren't worth an alert
    return v.stock <= threshold && !v.low_stock_alerted_at;
  });
  if (!due.length) {
    res.skipped = 1;
    return res;
  }

  const mail = lowStockEmail({
    threshold,
    rows: due.map((v) => ({
      product: (v.products as unknown as { title: string } | null)?.title ?? "Product",
      variant: v.title,
      stock: v.stock,
    })),
  });

  try {
    await sendOne({ from: await resolveFrom(db), to, ...mail });
    await db
      .from("variants")
      .update({ low_stock_alerted_at: new Date().toISOString() })
      .in("id", due.map((v) => v.id));
    res.sent = 1;
  } catch (e) {
    res.errors.push(e instanceof Error ? e.message : "send failed");
  }
  return res;
}

/* ----------------------------------------------------------- abandoned carts */

const HOURS = 3600_000;

/** Wait this long before nudging — people do finish checkout a few minutes later. */
const MIN_AGE_H = 4;
/** Past this, the nudge is stale and the Stripe session has usually expired. */
const MAX_AGE_H = 48;

export async function abandonedCartSweep(
  db: SupabaseClient,
  opts: { dryRun?: boolean } = {}
): Promise<SweepResult> {
  const res = empty();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.errors.push("Stripe isn't configured.");
    return res;
  }
  if ((await setting(db, "abandoned_cart_enabled")) === "off") {
    res.skipped = 1;
    return res;
  }
  const stripe = new Stripe(key);
  const now = Date.now();

  /* Stripe is the source of truth for these: it captures the email as soon as
     it's typed, which is well before we'd ever see an order row. */
  let sessions: Stripe.Checkout.Session[] = [];
  try {
    const list = await stripe.checkout.sessions.list({
      created: { gte: Math.floor((now - MAX_AGE_H * HOURS) / 1000) },
      limit: 100,
    });
    sessions = list.data;
  } catch (e) {
    res.errors.push(`Stripe: ${e instanceof Error ? e.message : "list failed"}`);
    return res;
  }

  const candidates = sessions.filter(
    (s) =>
      s.status !== "complete" &&
      s.customer_details?.email &&
      now - s.created * 1000 >= MIN_AGE_H * HOURS
  );
  if (!candidates.length) {
    res.skipped = 1;
    return res;
  }

  // Skip anything we've already handled, anything that did eventually turn
  // into an order, and anyone who has unsubscribed.
  const ids = candidates.map((s) => s.id);
  const [{ data: already }, { data: orders }] = await Promise.all([
    db.from("abandoned_carts").select("session_id,emailed_at").in("session_id", ids),
    db.from("orders").select("stripe_session_id").in("stripe_session_id", ids),
  ]);
  const emailed = new Set((already ?? []).filter((r) => r.emailed_at).map((r) => r.session_id));
  const ordered = new Set((orders ?? []).map((o) => o.stripe_session_id));

  const emails = [...new Set(candidates.map((s) => s.customer_details!.email!.toLowerCase()))];
  const { data: subs } = await db
    .from("subscribers")
    .select("email,unsubscribed_at,unsubscribe_token")
    .in("email", emails);
  const unsubscribed = new Set(
    (subs ?? []).filter((s) => s.unsubscribed_at).map((s) => s.email.toLowerCase())
  );
  const tokenFor = new Map(
    (subs ?? []).map((s) => [s.email.toLowerCase(), s.unsubscribe_token as string | null])
  );

  const from = await resolveFrom(db);

  for (const s of candidates) {
    const email = s.customer_details!.email!.toLowerCase();
    if (emailed.has(s.id) || ordered.has(s.id) || unsubscribed.has(email)) {
      res.skipped++;
      continue;
    }

    let items: { name: string; quantity: number }[] = [];
    try {
      const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 20 });
      items = li.data.map((l) => ({ name: l.description ?? "Item", quantity: l.quantity ?? 1 }));
    } catch {
      // a missing line-item list shouldn't block the nudge
    }

    const row = {
      session_id: s.id,
      email,
      total_cents: s.amount_total ?? 0,
      currency: s.currency ?? "aud",
      items,
      // only open sessions can be resumed; expired ones go to the store
      resume_url: s.status === "open" ? s.url : null,
      started_at: new Date(s.created * 1000).toISOString(),
    };

    if (opts.dryRun) {
      await db.from("abandoned_carts").upsert(row, { onConflict: "session_id" });
      res.skipped++;
      continue;
    }

    try {
      const mail = abandonedCartEmail({
        items,
        totalCents: row.total_cents,
        currency: row.currency,
        resumeUrl: row.resume_url ?? `${siteUrl()}/store`,
        unsubscribeUrl: tokenFor.has(email) ? unsubscribeUrl(tokenFor.get(email)!) : null,
      });
      await sendOne({ from, to: email, ...mail });
      await db
        .from("abandoned_carts")
        .upsert({ ...row, emailed_at: new Date().toISOString() }, { onConflict: "session_id" });
      res.sent++;
    } catch (e) {
      // record the cart anyway so it shows in the admin, but leave emailed_at
      // null so tomorrow's run retries it
      await db.from("abandoned_carts").upsert(row, { onConflict: "session_id" });
      res.errors.push(`${email}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }
  return res;
}

/** Everything the daily cron does, in one call. */
export async function runDailyAutomations(db: SupabaseClient) {
  const [abandoned, lowStock] = await Promise.all([abandonedCartSweep(db), lowStockSweep(db)]);
  return { abandoned, lowStock };
}
