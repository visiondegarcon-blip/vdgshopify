import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { blocksToHtml, blocksToText, type Block, type EmailFont } from "@/lib/emailHtml";
import { DEFAULT_FROM, sendCampaignEmails, sendOne, siteUrl } from "@/lib/resendSend";

/* Single admin endpoint. Every call must carry the caller's Supabase access
   token; we verify it server-side and check the email against the allowlist
   before doing anything with the service-role client. */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "visiondegarcon@gmail.com,dngabo2@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// The JWT is already signature-verified by the auth.getUser() network call
// below; decoding its payload here just reads the `aal` claim it carries.
function decodeAal(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).aal ?? null;
  } catch {
    return null;
  }
}

// `requireAal2: false` is used only by the "me" action — the frontend calls
// it just to learn whether this email is on the allowlist at all, before it
// knows whether to show the 2FA prompt. Enforcing aal2 there too created a
// deadlock: a password-only (aal1) login would fail "me" identically to a
// non-admin account, so the UI showed "not an admin account" and the user
// was never given the chance to enter their 6-digit code.
async function authorize(req: NextRequest, requireAal2 = true) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user?.email) return null;
  if (!ADMIN_EMAILS.includes(data.user.email.toLowerCase())) return null;

  // If this account has TOTP enrolled, a password-only (aal1) token is not
  // enough for real actions — require the token to have cleared the aal2 challenge.
  const hasVerifiedTotp = (data.user.factors ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );
  if (requireAal2 && hasVerifiedTotp && decodeAal(token) !== "aal2") return null;

  return data.user;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const user = await authorize(req, action !== "me");
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const db = admin();

  try {
    switch (action) {
      case "me":
        return NextResponse.json({ email: user.email });

      case "stats": {
        const { data: orders } = await db
          .from("orders")
          .select("id,total_cents,currency,status,fulfillment_status,created_at,email");
        const { data: variants } = await db.from("variants").select("id,stock");
        const paid = (orders ?? []).filter((o) => o.status === "paid");
        return NextResponse.json({
          orders: orders ?? [],
          totalSalesCents: paid.reduce((n, o) => n + o.total_cents, 0),
          orderCount: paid.length,
          unfulfilled: paid.filter((o) => o.fulfillment_status === "unfulfilled").length,
          unitsInStock: (variants ?? []).reduce((n, v) => n + v.stock, 0),
        });
      }

      case "list_orders": {
        const { data } = await db
          .from("orders")
          .select("*, order_items(product_title,variant_title,quantity,unit_price_cents)")
          .order("created_at", { ascending: false });
        return NextResponse.json({ orders: data ?? [] });
      }

      case "set_fulfillment": {
        const { orderId, fulfillment_status } = body;
        await db.from("orders").update({ fulfillment_status }).eq("id", orderId);
        return NextResponse.json({ ok: true });
      }

      /* Mark an order shipped, optionally record a tracking number, and tell
         the customer. The status change is committed before the email is
         attempted so a mail failure can never leave the order stuck as
         unshipped — the response reports the email outcome separately. */
      case "mark_shipped": {
        const { orderId, trackingNumber, notify } = body;
        const tracking = typeof trackingNumber === "string" ? trackingNumber.trim() : "";

        const { data: order } = await db
          .from("orders")
          .select("id,email,shipping_name,fulfillment_status,order_items(product_title,variant_title,quantity)")
          .eq("id", orderId)
          .single();
        if (!order) throw new Error("Order not found");

        const { guessTrackingUrl } = await import("@/lib/shippedEmail");
        const trackingUrl = tracking ? guessTrackingUrl(tracking) : null;

        await db
          .from("orders")
          .update({
            fulfillment_status: "fulfilled",
            tracking_number: tracking || null,
            tracking_url: trackingUrl,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (notify === false) return NextResponse.json({ ok: true, emailed: false });
        if (!order.email || order.email === "unknown")
          return NextResponse.json({ ok: true, emailed: false, emailNote: "No email address on this order." });

        try {
          const { shippedEmail } = await import("@/lib/shippedEmail");
          const { data: fromRow } = await db
            .from("site_settings")
            .select("value")
            .eq("key", "email_from")
            .maybeSingle();
          const mail = shippedEmail({
            orderId: order.id,
            customerName: order.shipping_name,
            trackingNumber: tracking,
            trackingUrl,
            items: order.order_items ?? [],
          });
          await sendOne({
            from: fromRow?.value?.trim() || DEFAULT_FROM,
            to: order.email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          });
          return NextResponse.json({ ok: true, emailed: true });
        } catch (e) {
          // Shipped state is already saved — surface the mail problem only.
          return NextResponse.json({
            ok: true,
            emailed: false,
            emailNote: e instanceof Error ? e.message : "Could not send the email.",
          });
        }
      }

      case "refund_order": {
        const { orderId, amountCents, restock } = body;
        const { data: order } = await db
          .from("orders")
          .select("id,total_cents,refunded_cents,status,stripe_session_id,source")
          .eq("id", orderId)
          .single();
        if (!order) throw new Error("Order not found");
        if (order.source === "shopify")
          throw new Error("This is an imported Shopify order — refund it in Shopify, not here.");
        if (!order.stripe_session_id?.startsWith("cs_"))
          throw new Error("This order has no Stripe payment to refund.");

        const alreadyRefunded = order.refunded_cents ?? 0;
        const remaining = order.total_cents - alreadyRefunded;
        if (remaining <= 0) throw new Error("This order is already fully refunded.");

        // Default to refunding whatever is still outstanding.
        const amount = Math.min(
          remaining,
          Math.max(1, Math.round(Number(amountCents) || remaining))
        );

        const StripeLib = (await import("stripe")).default;
        const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (!paymentIntent) throw new Error("Could not find the Stripe payment for this order.");

        await stripe.refunds.create({ payment_intent: paymentIntent, amount });

        const refundedTotal = alreadyRefunded + amount;
        await db
          .from("orders")
          .update({
            refunded_cents: refundedTotal,
            refunded_at: new Date().toISOString(),
            status: refundedTotal >= order.total_cents ? "refunded" : "partially_refunded",
          })
          .eq("id", orderId);

        // Optionally put the stock back on the shelf.
        if (restock) {
          const { data: items } = await db
            .from("order_items")
            .select("variant_id,quantity")
            .eq("order_id", orderId);
          for (const it of items ?? []) {
            if (!it.variant_id) continue;
            const { data: v } = await db.from("variants").select("stock").eq("id", it.variant_id).single();
            if (v) await db.from("variants").update({ stock: v.stock + it.quantity }).eq("id", it.variant_id);
          }
        }

        return NextResponse.json({ ok: true, refundedCents: refundedTotal });
      }

      case "list_shipping": {
        const { data: regions } = await db.from("shipping_regions").select("*").order("sort");
        const { data: rates } = await db.from("shipping_rates").select("*").order("max_weight_g");
        const { data: settingsRows } = await db
          .from("site_settings")
          .select("key,value")
          .in("key", ["shipping_default_weight_g", "shipping_overflow_enabled", "shipping_overflow_per_500g_cents"]);
        return NextResponse.json({
          regions: regions ?? [],
          rates: rates ?? [],
          settings: Object.fromEntries((settingsRows ?? []).map((s) => [s.key, s.value])),
        });
      }

      case "save_region": {
        const { id, name, countries, sort } = body;
        const fields = {
          name: String(name || "Untitled region"),
          countries: (Array.isArray(countries) ? countries : [])
            .map((c: string) => String(c).trim().toUpperCase())
            .filter(Boolean),
          sort: Number(sort) || 0,
        };
        if (id) {
          await db.from("shipping_regions").update(fields).eq("id", id);
          return NextResponse.json({ id });
        }
        const { data, error } = await db.from("shipping_regions").insert(fields).select().single();
        if (error) throw error;
        return NextResponse.json({ id: data.id });
      }

      case "delete_region": {
        await db.from("shipping_regions").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "save_rate": {
        const { regionId, service, maxWeightG, priceCents } = body;
        const row = {
          region_id: Number(regionId),
          service: service === "express" ? "express" : "standard",
          max_weight_g: Math.max(1, Math.round(Number(maxWeightG) || 0)),
          price_cents: Math.max(0, Math.round(Number(priceCents) || 0)),
        };
        const { error } = await db
          .from("shipping_rates")
          .upsert(row, { onConflict: "region_id,service,max_weight_g" });
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "delete_rate": {
        await db.from("shipping_rates").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "list_products": {
        const { data } = await db
          .from("products")
          .select("*, product_images(id,url,position), variants(id,title,price_cents,compare_at_cents,stock,position)")
          .order("sort");
        return NextResponse.json({ products: data ?? [] });
      }

      case "update_product": {
        const { id, fields } = body; // {title?, handle?, description_html?, status?, sort?}
        const allowed = ["title", "handle", "description_html", "status", "sort"];
        const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
        const { error } = await db.from("products").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "create_product": {
        const { title } = body;
        const handle =
          String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
          "-" + Math.random().toString(36).slice(2, 6);
        const { data, error } = await db
          .from("products")
          .insert({ title, handle, status: "draft", sort: 50 })
          .select()
          .single();
        if (error) throw error;
        await db.from("variants").insert({ product_id: data.id, title: "Default", price_cents: 0, stock: 0, position: 0 });
        return NextResponse.json({ product: data });
      }

      case "delete_product": {
        await db.from("products").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "update_variant": {
        const { id, fields } = body; // {title?, price_cents?, compare_at_cents?, stock?, weight_g?}
        const allowed = ["title", "price_cents", "compare_at_cents", "stock", "weight_g", "position"];
        const patch = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
        const { error } = await db.from("variants").update(patch).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "create_variant": {
        const { productId, title } = body;
        const { data, error } = await db
          .from("variants")
          .insert({ product_id: productId, title, price_cents: 0, stock: 0, position: 99 })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ variant: data });
      }

      case "delete_variant": {
        await db.from("variants").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "set_product_price": {
        // one price across all of a product's variants (sizes share a price)
        const { productId, price_cents } = body;
        const cents = Math.round(Number(price_cents));
        if (!Number.isFinite(cents) || cents < 50) throw new Error("Price must be at least $0.50");
        const { error } = await db.from("variants").update({ price_cents: cents }).eq("product_id", productId);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "upload_asset": {
        // generic site asset (hero backgrounds etc.) -> Supabase Storage
        const { filename, base64 } = body;
        const ext = (String(filename).split(".").pop() || "png").toLowerCase();
        if (!["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) throw new Error("Unsupported file type");
        const path = `site/${Date.now()}.${ext}`;
        const buf = Buffer.from(base64, "base64");
        const { error } = await db.storage.from("product-images").upload(path, buf, {
          contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
        });
        if (error) throw error;
        const { data: pub } = db.storage.from("product-images").getPublicUrl(path);
        return NextResponse.json({ url: pub.publicUrl });
      }

      case "upload_image": {
        // base64 payload from the admin UI -> Supabase Storage (public bucket)
        const { productId, filename, base64 } = body;
        const ext = (filename.split(".").pop() || "png").toLowerCase();
        const path = `p${productId}/${Date.now()}.${ext}`;
        const buf = Buffer.from(base64, "base64");
        const { error } = await db.storage.from("product-images").upload(path, buf, {
          contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
        });
        if (error) throw error;
        const { data: pub } = db.storage.from("product-images").getPublicUrl(path);
        const { data: maxPos } = await db
          .from("product_images")
          .select("position")
          .eq("product_id", productId)
          .order("position", { ascending: false })
          .limit(1);
        await db.from("product_images").insert({
          product_id: productId,
          url: pub.publicUrl,
          position: (maxPos?.[0]?.position ?? -1) + 1,
        });
        return NextResponse.json({ url: pub.publicUrl });
      }

      case "delete_image": {
        await db.from("product_images").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "customers": {
        const { data: orders } = await db
          .from("orders")
          .select("email,total_cents,status,created_at,shipping_name");
        const map = new Map<string, { email: string; name: string | null; orders: number; spentCents: number; last: string }>();
        for (const o of orders ?? []) {
          if (o.status !== "paid") continue;
          const cur = map.get(o.email) ?? { email: o.email, name: o.shipping_name, orders: 0, spentCents: 0, last: o.created_at };
          cur.orders += 1;
          cur.spentCents += o.total_cents;
          if (o.created_at > cur.last) cur.last = o.created_at;
          if (!cur.name && o.shipping_name) cur.name = o.shipping_name;
          map.set(o.email, cur);
        }
        return NextResponse.json({ customers: [...map.values()].sort((a, b) => b.spentCents - a.spentCents) });
      }

      case "speed_metrics": {
        // Shopify-style Online Store dashboard: web-vitals P75s + device sessions
        const days = Math.min(Number(body.days) || 30, 90);
        const cutoff = new Date(Date.now() - days * 864e5).toISOString();
        const { data: vitals } = await db
          .from("events")
          .select("meta")
          .eq("event", "web_vital")
          .gte("ts", cutoff)
          .limit(20000);
        const byName: Record<string, number[]> = {};
        for (const v of vitals ?? []) {
          const m = v.meta as { name?: string; value?: number };
          if (!m?.name || typeof m.value !== "number") continue;
          (byName[m.name] ??= []).push(m.value);
        }
        const p75 = (arr: number[]) => {
          if (!arr.length) return null;
          const s = [...arr].sort((a, b) => a - b);
          return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))];
        };
        const { data: sessions } = await db
          .from("events")
          .select("session_id,device")
          .eq("event", "page_view")
          .gte("ts", cutoff)
          .limit(50000);
        const devices: Record<string, Set<string>> = {};
        for (const s of sessions ?? []) {
          (devices[s.device ?? "other"] ??= new Set()).add(s.session_id);
        }
        return NextResponse.json({
          lcp: p75(byName.LCP ?? []),
          inp: p75(byName.INP ?? []),
          cls: p75(byName.CLS ?? []),
          samples: { lcp: (byName.LCP ?? []).length, inp: (byName.INP ?? []).length, cls: (byName.CLS ?? []).length },
          devices: Object.fromEntries(Object.entries(devices).map(([k, v]) => [k, v.size])),
        });
      }

      case "get_settings": {
        const { data } = await db.from("site_settings").select("key,value");
        return NextResponse.json({ settings: Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) });
      }

      case "update_settings": {
        const { settings } = body; // { key: value }
        const allowed = [
          "banner_text",
          "shipping_free_label",
          "shipping_intl_label",
          "shipping_intl_cents",
          "active_theme_id",
          "content_home",
          "content_product",
          "content_store",
          "content_about",
          "content_buttons",
          "content_fonts",
          "lock_config",
          "popup_config",
          "email_from",
        ];
        for (const [key, value] of Object.entries(settings ?? {})) {
          if (!allowed.includes(key)) continue;
          const { error } = await db
            .from("site_settings")
            .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
          if (error) throw error;
        }
        return NextResponse.json({ ok: true });
      }

      case "optimization": {
        const days = Math.min(Number(body.days) || 30, 3650);
        const cutoff = new Date(Date.now() - days * 864e5).toISOString();
        const prevCutoff = new Date(Date.now() - 2 * days * 864e5).toISOString();
        const { data: events } = await db
          .from("events")
          .select("session_id,event,path,country,city,referrer,device,ts,meta")
          .gte("ts", prevCutoff)
          .order("ts")
          .limit(100000);
        const { data: orders } = await db
          .from("orders")
          .select("created_at,status,total_cents, order_items(product_title,variant_title,quantity)")
          .eq("status", "paid");

        const cur = (events ?? []).filter((e) => e.ts >= cutoff);
        const prev = (events ?? []).filter((e) => e.ts < cutoff);

        // sessions
        const bySession = new Map<string, typeof cur>();
        for (const e of cur) {
          if (!bySession.has(e.session_id)) bySession.set(e.session_id, []);
          bySession.get(e.session_id)!.push(e);
        }

        // avg session duration (sessions with 2+ events)
        let durSum = 0, durN = 0;
        for (const evs of bySession.values()) {
          if (evs.length < 2) continue;
          const ts = evs.map((e) => new Date(e.ts).getTime());
          durSum += Math.max(...ts) - Math.min(...ts);
          durN++;
        }

        // funnel
        let carted = 0, checkout = 0, purchased = 0;
        for (const evs of bySession.values()) {
          const kinds = new Set(evs.map((e) => e.event));
          if (kinds.has("add_to_cart")) carted++;
          if (kinds.has("checkout_started")) checkout++;
          if (kinds.has("purchase")) purchased++;
        }

        // geo trends: sessions per country now vs previous window
        const geoCount = (list: typeof cur) => {
          const m = new Map<string, Set<string>>();
          for (const e of list) {
            if (e.event !== "page_view" || !e.country) continue;
            (m.get(e.country) ?? m.set(e.country, new Set()).get(e.country)!).add(e.session_id);
          }
          return m;
        };
        const geoNow = geoCount(cur), geoPrev = geoCount(prev);
        const trending = [...geoNow.entries()]
          .map(([c, s]) => ({ country: c, sessions: s.size, prev: geoPrev.get(c)?.size ?? 0 }))
          .sort((a, b) => b.sessions - a.sessions)
          .slice(0, 8);
        const cities = new Map<string, number>();
        for (const e of cur) if (e.event === "page_view" && e.city) cities.set(e.city, (cities.get(e.city) ?? 0) + 1);

        // referrers grouped by host bucket
        const refBuckets = new Map<string, number>();
        for (const evs of bySession.values()) {
          const first = evs.find((e) => e.event === "page_view");
          let bucket = "Direct";
          const r = first?.referrer ?? "";
          if (r) {
            try {
              const host = new URL(r).hostname.replace(/^www\./, "");
              if (host.includes("instagram")) bucket = "Instagram";
              else if (host.includes("tiktok")) bucket = "TikTok";
              else if (host.includes("google")) bucket = "Google";
              else if (host.includes("facebook")) bucket = "Facebook";
              else if (host.includes("vdg-store") || host.includes("visiondegarcon")) bucket = "Internal";
              else bucket = host;
            } catch { bucket = "Other"; }
          }
          refBuckets.set(bucket, (refBuckets.get(bucket) ?? 0) + 1);
        }

        // click paths: first 3 page_view paths per session
        const paths = new Map<string, number>();
        for (const evs of bySession.values()) {
          const seq = evs.filter((e) => e.event === "page_view").slice(0, 3).map((e) => e.path).join(" → ");
          if (seq) paths.set(seq, (paths.get(seq) ?? 0) + 1);
        }

        // product views + sold-out demand
        const views = new Map<string, number>();
        const soldOutViews = new Map<string, number>();
        for (const e of cur) {
          if (e.event !== "product_view") continue;
          const m = e.meta as { handle?: string; title?: string; soldOut?: boolean };
          const key = m.title ?? m.handle ?? "?";
          views.set(key, (views.get(key) ?? 0) + 1);
          if (m.soldOut) soldOutViews.set(key, (soldOutViews.get(key) ?? 0) + 1);
        }

        // size interest: clicked (variant_click) and carted (add_to_cart meta)
        const sizeAgg = (eventName: string) => {
          const byProduct = new Map<string, Map<string, number>>();
          for (const e of cur) {
            if (e.event !== eventName) continue;
            const m = e.meta as { title?: string; handle?: string; variant?: string };
            const product = m.title ?? m.handle;
            if (!product || !m.variant) continue;
            const sizes = byProduct.get(product) ?? byProduct.set(product, new Map()).get(product)!;
            sizes.set(m.variant, (sizes.get(m.variant) ?? 0) + 1);
          }
          return [...byProduct.entries()].map(([product, sizes]) => ({
            product,
            sizes: [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          }));
        };
        const sizesClicked = sizeAgg("variant_click");
        const sizesCarted = sizeAgg("add_to_cart");

        // ATC rate per product: sessions that carted it / sessions that viewed it
        const viewSessions = new Map<string, Set<string>>();
        const cartSessions = new Map<string, Set<string>>();
        for (const e of cur) {
          if (e.event !== "product_view" && e.event !== "add_to_cart") continue;
          const m = e.meta as { title?: string; handle?: string };
          const product = m.title ?? m.handle;
          if (!product) continue;
          const map = e.event === "product_view" ? viewSessions : cartSessions;
          (map.get(product) ?? map.set(product, new Set()).get(product)!).add(e.session_id);
        }
        const atcRates = [...viewSessions.entries()]
          .map(([product, vs]) => ({
            product,
            viewed: vs.size,
            carted: cartSessions.get(product)?.size ?? 0,
            rate: vs.size ? Math.round(((cartSessions.get(product)?.size ?? 0) / vs.size) * 100) : 0,
          }))
          .sort((a, b) => b.viewed - a.viewed)
          .slice(0, 8);

        // landing + exit pages, traffic-by-hour heat, device split, new vs returning
        const landing = new Map<string, number>();
        const exits = new Map<string, number>();
        const trafficHeat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
        const devices = new Map<string, Set<string>>();
        const prevSessions = new Set(prev.map((e) => e.session_id));
        let returningVisitors = 0;
        for (const [sid, evs] of bySession.entries()) {
          const pvs = evs.filter((e) => e.event === "page_view");
          if (pvs.length) {
            landing.set(pvs[0].path ?? "?", (landing.get(pvs[0].path ?? "?") ?? 0) + 1);
            exits.set(pvs[pvs.length - 1].path ?? "?", (exits.get(pvs[pvs.length - 1].path ?? "?") ?? 0) + 1);
          }
          const dev = evs.find((e) => e.device)?.device ?? "unknown";
          (devices.get(dev) ?? devices.set(dev, new Set()).get(dev)!).add(sid);
          if (prevSessions.has(sid)) returningVisitors++;
        }
        for (const e of cur) {
          if (e.event !== "page_view") continue;
          const d = new Date(e.ts);
          trafficHeat[d.getUTCDay()][d.getUTCHours()]++;
        }

        // sellers + sizes sold from all paid orders in range window (incl. Shopify history)
        const sellers = new Map<string, number>();
        const hourHeat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
        const pairs = new Map<string, number>();
        const soldSizes = new Map<string, Map<string, number>>();
        for (const o of orders ?? []) {
          if (o.created_at < cutoff) continue;
          const d = new Date(o.created_at);
          hourHeat[d.getUTCDay()][d.getUTCHours()]++;
          const titles = [...new Set((o.order_items ?? []).map((i) => i.product_title))].sort();
          for (const i of o.order_items ?? []) {
            sellers.set(i.product_title, (sellers.get(i.product_title) ?? 0) + i.quantity);
            if (i.variant_title && i.variant_title !== "Default") {
              const sizes = soldSizes.get(i.product_title) ?? soldSizes.set(i.product_title, new Map()).get(i.product_title)!;
              sizes.set(i.variant_title, (sizes.get(i.variant_title) ?? 0) + i.quantity);
            }
          }
          for (let a = 0; a < titles.length; a++)
            for (let b = a + 1; b < titles.length; b++)
              pairs.set(`${titles[a]} + ${titles[b]}`, (pairs.get(`${titles[a]} + ${titles[b]}`) ?? 0) + 1);
        }
        const sizesSold = [...soldSizes.entries()]
          .map(([product, sizes]) => ({
            product,
            sizes: [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          }))
          .sort((a, b) => b.sizes.reduce((n, [, v]) => n + v, 0) - a.sizes.reduce((n, [, v]) => n + v, 0));

        const products = [...new Set([...views.keys(), ...sellers.keys()])].map((title) => ({
          title,
          views: views.get(title) ?? 0,
          sold: sellers.get(title) ?? 0,
          conversion: (views.get(title) ?? 0) > 0 ? (sellers.get(title) ?? 0) / (views.get(title) ?? 1) : null,
        }));

        return NextResponse.json({
          sessions: bySession.size,
          avgSessionMs: durN ? Math.round(durSum / durN) : null,
          funnel: { sessions: bySession.size, carted, checkout, purchased },
          cartAbandonPct: carted ? Math.round(((carted - purchased) / carted) * 100) : null,
          checkoutAbandonPct: checkout ? Math.round(((checkout - purchased) / checkout) * 100) : null,
          trending,
          cities: [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
          referrers: [...refBuckets.entries()].sort((a, b) => b[1] - a[1]),
          clickPaths: [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
          products: products.sort((a, b) => b.sold - a.sold || b.views - a.views),
          soldOutDemand: [...soldOutViews.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          pairs: [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          hourHeat,
          sizesClicked,
          sizesCarted,
          sizesSold,
          atcRates,
          landing: [...landing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          exits: [...exits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
          trafficHeat,
          devices: [...devices.entries()].map(([d, s]) => [d, s.size] as [string, number]).sort((a, b) => b[1] - a[1]),
          returningVisitors,
          newVisitors: bySession.size - returningVisitors,
        });
      }

      case "list_subscribers": {
        const { data } = await db
          .from("subscribers")
          .select("id,email,phone,source,consented_at,unsubscribed_at,created_at")
          .order("created_at", { ascending: false });
        return NextResponse.json({ subscribers: data ?? [] });
      }

      case "import_checkout_emails": {
        const { data: orders } = await db.from("orders").select("email").eq("status", "paid");
        const emails = [...new Set((orders ?? []).map((o) => o.email).filter((e) => e && e.includes("@")))];
        let added = 0;
        for (const email of emails) {
          const { error } = await db
            .from("subscribers")
            .insert({ email, source: "checkout" })
            .select()
            .single();
          if (!error) added++;
        }
        return NextResponse.json({ added, scanned: emails.length });
      }

      case "delete_subscriber": {
        await db.from("subscribers").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "list_templates": {
        const { data } = await db.from("email_templates").select("*").order("updated_at", { ascending: false });
        return NextResponse.json({ templates: data ?? [] });
      }

      case "save_template": {
        const { id, name, blocks } = body;
        const font = ["mono", "serif", "sans", "times"].includes(body.font) ? body.font : "mono";
        if (id) {
          const { error } = await db
            .from("email_templates")
            .update({ name, blocks, font, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          return NextResponse.json({ id });
        }
        const { data, error } = await db.from("email_templates").insert({ name, blocks, font }).select().single();
        if (error) throw error;
        return NextResponse.json({ id: data.id });
      }

      case "delete_template": {
        await db.from("email_templates").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "list_campaigns": {
        const { data } = await db
          .from("campaigns")
          .select("*, email_templates(name)")
          .order("created_at", { ascending: false });
        return NextResponse.json({ campaigns: data ?? [] });
      }

      case "save_campaign": {
        const { id, name, subject, template_id } = body;
        if (id) {
          const { error } = await db.from("campaigns").update({ name, subject, template_id }).eq("id", id);
          if (error) throw error;
          return NextResponse.json({ id });
        }
        const { data, error } = await db
          .from("campaigns")
          .insert({ name, subject, template_id, status: "draft" })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ id: data.id });
      }

      case "send_test_email": {
        // Preview a campaign in a real inbox before it goes to subscribers.
        const { campaignId, to } = body;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to ?? ""))) throw new Error("Enter a valid email address.");
        const { data: campaign } = await db
          .from("campaigns")
          .select("*, email_templates(blocks,font)")
          .eq("id", campaignId)
          .single();
        if (!campaign) throw new Error("Campaign not found.");
        const tpl = campaign.email_templates as { blocks: Block[]; font?: EmailFont } | null;
        if (!tpl) throw new Error("This campaign has no template attached yet.");
        const { data: fromRow } = await db.from("site_settings").select("value").eq("key", "email_from").maybeSingle();
        const from = fromRow?.value || DEFAULT_FROM;
        const url = `${siteUrl()}/unsubscribe?token=test`;
        await sendOne({
          from,
          to: String(to),
          subject: `[TEST] ${campaign.subject || campaign.name}`,
          html: blocksToHtml(tpl.blocks ?? [], tpl.font ?? "mono").replaceAll("{{unsubscribe_url}}", url),
          text: blocksToText(tpl.blocks ?? []).replaceAll("{{unsubscribe_url}}", url),
        });
        return NextResponse.json({ ok: true, to, from });
      }

      case "send_campaign": {
        const { id, force } = body;
        const { data: campaign } = await db
          .from("campaigns")
          .select("*, email_templates(blocks,font)")
          .eq("id", id)
          .single();
        if (!campaign) throw new Error("Campaign not found.");
        if (campaign.status === "sent" && !force)
          throw new Error("This campaign was already sent. Duplicate sends are blocked.");
        const tpl = campaign.email_templates as { blocks: Block[]; font?: EmailFont } | null;
        if (!tpl) throw new Error("Attach a template to this campaign first.");
        if (!campaign.subject) throw new Error("Give this campaign a subject line first.");

        const { data: subs } = await db
          .from("subscribers")
          .select("email,unsubscribe_token")
          .is("unsubscribed_at", null);
        const recipients = (subs ?? [])
          .filter((s) => s.email && s.email.includes("@"))
          .map((s) => ({ email: s.email as string, unsubscribeToken: s.unsubscribe_token as string | null }));
        if (!recipients.length) throw new Error("No subscribed contacts to send to.");

        const { data: fromRow } = await db.from("site_settings").select("value").eq("key", "email_from").maybeSingle();
        const from = fromRow?.value || DEFAULT_FROM;

        const result = await sendCampaignEmails({
          from,
          subject: campaign.subject,
          html: blocksToHtml(tpl.blocks ?? [], tpl.font ?? "mono"),
          text: blocksToText(tpl.blocks ?? []),
          recipients,
        });

        if (result.sent === 0) throw new Error(result.errors[0] ?? "Nothing was sent.");
        await db
          .from("campaigns")
          .update({
            status: result.failed ? "partially_sent" : "sent",
            sent_at: new Date().toISOString(),
            recipient_count: result.sent,
          })
          .eq("id", id);
        return NextResponse.json(result);
      }

      case "delete_campaign": {
        await db.from("campaigns").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "finance_overview": {
        const days = Math.min(Number(body.days) || 90, 3650);
        const cutoffIso = new Date(Date.now() - days * 864e5).toISOString();
        // Sales figures come from the orders table so imported Shopify history
        // counts too — Stripe balance data only covers charges on the new site.
        const { data: rangeOrders } = await db
          .from("orders")
          .select("total_cents,discount_cents,status,created_at")
          .gte("created_at", cutoffIso);
        let gross = 0, discounts = 0, refunds = 0, orderCount = 0;
        for (const o of rangeOrders ?? []) {
          if (o.status === "paid") {
            gross += o.total_cents;
            discounts += o.discount_cents ?? 0;
            orderCount++;
          } else if (o.status === "refunded") {
            refunds += o.total_cents;
          }
        }
        let fees = 0, stripeGross = 0, stripeCharges = 0;
        const txns: { ts: number; type: string; amount: number; fee: number; net: number; desc: string }[] = [];
        const payouts: { id: string; amount: number; arrival: number; status: string }[] = [];
        try {
          const since = Math.floor((Date.now() - days * 864e5) / 1000);
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
          for await (const t of stripe.balanceTransactions.list({ created: { gte: since }, limit: 100 })) {
            txns.push({ ts: t.created, type: t.type, amount: t.amount, fee: t.fee, net: t.net, desc: t.description ?? "" });
            if (t.type === "charge" || t.type === "payment") {
              stripeGross += t.amount; fees += t.fee; stripeCharges++;
            }
            if (txns.length >= 1000) break;
          }
          for await (const p of stripe.payouts.list({ limit: 10 })) {
            payouts.push({ id: p.id, amount: p.amount, arrival: p.arrival_date, status: p.status });
            if (payouts.length >= 10) break;
          }
        } catch {}
        return NextResponse.json({
          gross, discounts, refunds, orderCount,
          fees, net: gross - fees, stripeGross, stripeCharges,
          payouts, txns: txns.slice(0, 200),
        });
      }

      case "journeys": {
        const days = Math.min(Number(body.days) || 3650, 3650);
        const cutoff = new Date(Date.now() - days * 864e5).toISOString();
        const { data: events } = await db
          .from("events")
          .select("session_id,event,path,ts")
          .eq("event", "page_view")
          .gte("ts", cutoff)
          .order("ts")
          .limit(100000);
        const bySession = new Map<string, string[]>();
        for (const e of events ?? []) {
          if (!e.path) continue;
          const seq = bySession.get(e.session_id) ?? [];
          // collapse consecutive repeats (reloads) and cap at 5 steps
          if (seq.length < 5 && seq[seq.length - 1] !== e.path) seq.push(e.path);
          bySession.set(e.session_id, seq);
        }
        const seqCounts = new Map<string, number>();
        const transitions = new Map<string, number>(); // "step|from|to" -> count
        const nodeCounts = new Map<string, number>(); // "step|path" -> count
        let exits = 0;
        for (const seq of bySession.values()) {
          if (!seq.length) continue;
          seqCounts.set(seq.join("→"), (seqCounts.get(seq.join("→")) ?? 0) + 1);
          if (seq.length === 1) exits++;
          seq.forEach((p, i) => {
            if (i >= 4) return;
            nodeCounts.set(`${i}|${p}`, (nodeCounts.get(`${i}|${p}`) ?? 0) + 1);
            if (i < seq.length - 1 && i < 3)
              transitions.set(`${i}|${p}|${seq[i + 1]}`, (transitions.get(`${i}|${p}|${seq[i + 1]}`) ?? 0) + 1);
          });
        }
        return NextResponse.json({
          totalSessions: bySession.size,
          bouncedSessions: exits,
          sequences: [...seqCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([seq, count]) => ({ steps: seq.split("→"), count })),
          nodes: [...nodeCounts.entries()].map(([k, count]) => {
            const [step, path] = [k.slice(0, 1), k.slice(2)];
            return { step: Number(step), path, count };
          }),
          transitions: [...transitions.entries()].map(([k, count]) => {
            const [step, from, to] = k.split("|");
            return { step: Number(step), from, to, count };
          }),
        });
      }

      case "finance_eofy": {
        // AU financial year: 1 Jul (year-1) .. 30 Jun (year)
        const fy = Number(body.fy) || new Date().getFullYear();
        const start = new Date(Date.UTC(fy - 1, 6, 1));
        const end = new Date(Date.UTC(fy, 6, 1));
        const { data: orders } = await db
          .from("orders")
          .select("total_cents,discount_cents,currency,status,created_at,shipping_address,source")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString());
        const paid = (orders ?? []).filter((o) => o.status === "paid");
        const monthly: Record<string, { gross: number; orders: number }> = {};
        let gross = 0, discounts = 0, auGross = 0;
        for (const o of paid) {
          gross += o.total_cents;
          discounts += o.discount_cents ?? 0;
          const country = (o.shipping_address as { country?: string } | null)?.country;
          if (!country || country === "AU") auGross += o.total_cents;
          const m = o.created_at.slice(0, 7);
          monthly[m] = { gross: (monthly[m]?.gross ?? 0) + o.total_cents, orders: (monthly[m]?.orders ?? 0) + 1 };
        }
        // Stripe fees for the same window (best effort)
        let fees = 0;
        try {
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
          for await (const t of stripe.balanceTransactions.list({
            created: { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(end.getTime() / 1000) },
            limit: 100,
          })) {
            if (t.type === "charge" || t.type === "payment") fees += t.fee;
          }
        } catch {}
        const gstEstimate = Math.round(auGross / 11);
        return NextResponse.json({
          fy, start: start.toISOString(), end: end.toISOString(),
          gross, discounts, fees, net: gross - fees, auGross, gstEstimate,
          orderCount: paid.length, monthly,
        });
      }

      case "export_orders_csv": {
        const { data } = await db
          .from("orders")
          .select("*, order_items(product_title,variant_title,quantity,unit_price_cents)")
          .order("created_at");
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [
          "order_id,date,email,name,status,fulfillment,source,total_aud,discount_aud,country,items",
        ];
        for (const o of data ?? []) {
          const items = (o.order_items as { product_title: string; variant_title: string; quantity: number }[])
            .map((i) => `${i.quantity}x ${i.product_title} (${i.variant_title})`)
            .join("; ");
          lines.push(
            [
              o.id, o.created_at, esc(o.email), esc(o.shipping_name), o.status,
              o.fulfillment_status ?? "", o.source,
              (o.total_cents / 100).toFixed(2), ((o.discount_cents ?? 0) / 100).toFixed(2),
              esc((o.shipping_address as { country?: string } | null)?.country), esc(items),
            ].join(",")
          );
        }
        return NextResponse.json({ csv: lines.join("\n") });
      }

      case "live_view": {
        const fiveMin = new Date(Date.now() - 5 * 6e4).toISOString();
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const { data: recent } = await db
          .from("events")
          .select("session_id,country,city,path,ts,event")
          .gte("ts", fiveMin)
          .order("ts", { ascending: false })
          .limit(2000);
        const live = new Map<string, { country: string | null; city: string | null; path: string | null }>();
        for (const e of recent ?? []) {
          if (e.event !== "page_view") continue;
          if (!live.has(e.session_id)) live.set(e.session_id, { country: e.country, city: e.city, path: e.path });
        }
        const { data: today } = await db
          .from("events")
          .select("session_id,event,path,country,city,ts")
          .gte("ts", dayStart.toISOString())
          .limit(50000);
        const sessionsToday = new Set<string>();
        let viewsToday = 0;
        const pages = new Map<string, number>();
        const locSessions = new Map<string, Set<string>>();
        const tenMin = new Date(Date.now() - 10 * 6e4).toISOString();
        const behaviorBySession = new Map<string, Set<string>>();
        for (const e of today ?? []) {
          if (e.event === "page_view") {
            sessionsToday.add(e.session_id);
            viewsToday++;
            pages.set(e.path ?? "?", (pages.get(e.path ?? "?") ?? 0) + 1);
            if (e.country) {
              const key = [e.country, e.city].filter(Boolean).join(" · ");
              (locSessions.get(key) ?? locSessions.set(key, new Set()).get(key)!).add(e.session_id);
            }
          }
          if (e.ts >= tenMin) {
            (behaviorBySession.get(e.session_id) ?? behaviorBySession.set(e.session_id, new Set()).get(e.session_id)!).add(e.event);
          }
        }
        let activeCarts = 0, checkingOut = 0, purchasedNow = 0;
        for (const kinds of behaviorBySession.values()) {
          if (kinds.has("purchase")) purchasedNow++;
          else if (kinds.has("checkout_started")) checkingOut++;
          else if (kinds.has("add_to_cart")) activeCarts++;
        }
        const { data: todayOrders } = await db
          .from("orders")
          .select("total_cents,status")
          .gte("created_at", dayStart.toISOString());
        let ordersToday = 0, salesToday = 0;
        for (const o of todayOrders ?? []) {
          if (o.status !== "paid") continue;
          ordersToday++;
          salesToday += o.total_cents;
        }
        return NextResponse.json({
          liveVisitors: [...live.values()],
          liveCount: live.size,
          sessionsToday: sessionsToday.size,
          viewsToday,
          ordersToday,
          salesToday,
          behavior: { activeCarts, checkingOut, purchased: purchasedNow },
          locations: [...locSessions.entries()]
            .map(([k, s]) => [k, s.size] as [string, number])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6),
          topPages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
        });
      }

      case "list_discounts": {
        // refresh redemption counts from Stripe so the table is truthful
        const { data: codes } = await db.from("discount_codes").select("*").order("created_at", { ascending: false });
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey && (codes ?? []).length) {
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(stripeKey);
          for (const c of codes ?? []) {
            if (!c.stripe_promo_id) continue; // local (free-shipping) codes
            try {
              const promo = await stripe.promotionCodes.retrieve(c.stripe_promo_id);
              if (promo.times_redeemed !== c.times_redeemed || promo.active !== c.active) {
                await db
                  .from("discount_codes")
                  .update({ times_redeemed: promo.times_redeemed, active: promo.active })
                  .eq("id", c.id);
                c.times_redeemed = promo.times_redeemed;
                c.active = promo.active;
              }
            } catch {}
          }
        }
        return NextResponse.json({ discounts: codes ?? [] });
      }

      case "create_discount": {
        const { code, kind, value, maxRedemptions, expiresAt, restrictions } = body as {
          code: string; kind: "percent" | "amount" | "free_shipping"; value?: number;
          maxRedemptions?: number; expiresAt?: string;
          restrictions?: { min_order_cents?: number; first_order_only?: boolean; one_per_customer?: boolean };
        };
        const clean = String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
        if (!clean) throw new Error("A code is required");
        const restr = {
          min_order_cents: Math.max(0, Math.round(Number(restrictions?.min_order_cents) || 0)),
          first_order_only: !!restrictions?.first_order_only,
          one_per_customer: !!restrictions?.one_per_customer,
        };
        let stripeCouponId: string | null = null;
        let stripePromoId: string | null = null;
        if (kind !== "free_shipping") {
          if (!value || value <= 0) throw new Error("A positive value is required");
          if (kind === "percent" && value > 100) throw new Error("Percent must be 1-100");
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
          const coupon = await stripe.coupons.create(
            kind === "percent"
              ? { percent_off: value, duration: "once", name: clean }
              : { amount_off: Math.round(value), currency: "aud", duration: "once", name: clean }
          );
          const promo = await stripe.promotionCodes.create({
            promotion: { type: "coupon", coupon: coupon.id },
            code: clean,
            ...(maxRedemptions ? { max_redemptions: Math.floor(maxRedemptions) } : {}),
            ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
            ...(restr.min_order_cents || restr.first_order_only
              ? {
                  restrictions: {
                    ...(restr.min_order_cents
                      ? { minimum_amount: restr.min_order_cents, minimum_amount_currency: "aud" }
                      : {}),
                    ...(restr.first_order_only ? { first_time_transaction: true } : {}),
                  },
                }
              : {}),
          });
          stripeCouponId = coupon.id;
          stripePromoId = promo.id;
        }
        const { data, error } = await db
          .from("discount_codes")
          .insert({
            code: clean,
            kind,
            stripe_coupon_id: stripeCouponId,
            stripe_promo_id: stripePromoId,
            percent_off: kind === "percent" ? value : null,
            amount_off_cents: kind === "amount" ? Math.round(value!) : null,
            max_redemptions: maxRedemptions ?? null,
            expires_at: expiresAt || null,
            restrictions: restr,
          })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ discount: data });
      }

      case "toggle_discount": {
        const { id, active } = body;
        const { data: row } = await db.from("discount_codes").select("stripe_promo_id").eq("id", id).single();
        if (!row) throw new Error("Not found");
        if (row.stripe_promo_id) {
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
          await stripe.promotionCodes.update(row.stripe_promo_id, { active: Boolean(active) });
        }
        await db.from("discount_codes").update({ active: Boolean(active) }).eq("id", id);
        return NextResponse.json({ ok: true });
      }

      case "delete_discount": {
        const { id } = body;
        const { data: row } = await db.from("discount_codes").select("stripe_promo_id,stripe_coupon_id").eq("id", id).single();
        if (!row) throw new Error("Not found");
        if (row.stripe_promo_id) {
          const StripeLib = (await import("stripe")).default;
          const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
          await stripe.promotionCodes.update(row.stripe_promo_id, { active: false });
        }
        await db.from("discount_codes").delete().eq("id", id);
        return NextResponse.json({ ok: true });
      }

      case "list_themes": {
        const { data } = await db.from("themes").select("*").order("id");
        const { data: active } = await db.from("site_settings").select("value").eq("key", "active_theme_id").maybeSingle();
        return NextResponse.json({ themes: data ?? [], activeId: active?.value ?? null });
      }

      case "save_snapshot": {
        const { name } = body;
        const { data: settings } = await db.from("site_settings").select("key,value");
        const payload = { settings: Object.fromEntries((settings ?? []).map((s) => [s.key, s.value])) };
        const { data, error } = await db
          .from("design_snapshots")
          .insert({ name: String(name || "Untitled design"), payload })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ snapshot: data });
      }

      case "list_snapshots": {
        const { data } = await db
          .from("design_snapshots")
          .select("id,name,created_at")
          .order("created_at", { ascending: false });
        return NextResponse.json({ snapshots: data ?? [] });
      }

      case "restore_snapshot": {
        const { id } = body;
        const { data } = await db.from("design_snapshots").select("payload").eq("id", id).single();
        const settings = (data?.payload as { settings?: Record<string, string> })?.settings ?? {};
        for (const [key, value] of Object.entries(settings)) {
          await db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
        }
        return NextResponse.json({ ok: true });
      }

      case "delete_snapshot": {
        await db.from("design_snapshots").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
