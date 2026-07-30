import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

async function authorize(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user?.email) return null;
  if (!ADMIN_EMAILS.includes(data.user.email.toLowerCase())) return null;

  // If this account has TOTP enrolled, a password-only (aal1) token is not
  // enough — require the token to have cleared the aal2 challenge.
  const hasVerifiedTotp = (data.user.factors ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );
  if (hasVerifiedTotp && decodeAal(token) !== "aal2") return null;

  return data.user;
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const db = admin();
  const body = await req.json().catch(() => ({}));
  const { action } = body;

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
        const { id, fields } = body; // {title?, price_cents?, compare_at_cents?, stock?}
        const allowed = ["title", "price_cents", "compare_at_cents", "stock", "position"];
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
          "lock_config",
          "popup_config",
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
          .select("session_id,event,path,country,city,referrer,ts,meta")
          .gte("ts", prevCutoff)
          .order("ts")
          .limit(100000);
        const { data: orders } = await db
          .from("orders")
          .select("created_at,status,total_cents, order_items(product_title,quantity)")
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

        // sellers from all paid orders in range window (use created_at cutoff)
        const sellers = new Map<string, number>();
        const hourHeat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
        const pairs = new Map<string, number>();
        for (const o of orders ?? []) {
          if (o.created_at < cutoff) continue;
          const d = new Date(o.created_at);
          hourHeat[d.getUTCDay()][d.getUTCHours()]++;
          const titles = [...new Set((o.order_items ?? []).map((i) => i.product_title))].sort();
          for (const i of o.order_items ?? []) sellers.set(i.product_title, (sellers.get(i.product_title) ?? 0) + i.quantity);
          for (let a = 0; a < titles.length; a++)
            for (let b = a + 1; b < titles.length; b++)
              pairs.set(`${titles[a]} + ${titles[b]}`, (pairs.get(`${titles[a]} + ${titles[b]}`) ?? 0) + 1);
        }

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
        if (id) {
          const { error } = await db
            .from("email_templates")
            .update({ name, blocks, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          return NextResponse.json({ id });
        }
        const { data, error } = await db.from("email_templates").insert({ name, blocks }).select().single();
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

      case "send_campaign": {
        // Deliberate placeholder until Daniel picks an email provider
        // (Resend account exists but visiondegarcon.fr is not verified there).
        return NextResponse.json(
          { error: "Sending not connected yet — choose an email provider (e.g. verify visiondegarcon.fr in Resend), then this button goes live." },
          { status: 501 }
        );
      }

      case "delete_campaign": {
        await db.from("campaigns").delete().eq("id", body.id);
        return NextResponse.json({ ok: true });
      }

      case "finance_overview": {
        const days = Math.min(Number(body.days) || 90, 3650);
        const since = Math.floor((Date.now() - days * 864e5) / 1000);
        const StripeLib = (await import("stripe")).default;
        const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
        let gross = 0, fees = 0, net = 0, refunds = 0, chargeCount = 0;
        const txns: { ts: number; type: string; amount: number; fee: number; net: number; desc: string }[] = [];
        for await (const t of stripe.balanceTransactions.list({ created: { gte: since }, limit: 100 })) {
          txns.push({ ts: t.created, type: t.type, amount: t.amount, fee: t.fee, net: t.net, desc: t.description ?? "" });
          if (t.type === "charge" || t.type === "payment") {
            gross += t.amount; fees += t.fee; net += t.net; chargeCount++;
          } else if (t.type.startsWith("refund")) {
            refunds += Math.abs(t.amount);
          }
          if (txns.length >= 1000) break;
        }
        const payouts: { id: string; amount: number; arrival: number; status: string }[] = [];
        for await (const p of stripe.payouts.list({ limit: 10 })) {
          payouts.push({ id: p.id, amount: p.amount, arrival: p.arrival_date, status: p.status });
          if (payouts.length >= 10) break;
        }
        return NextResponse.json({ gross, fees, net, refunds, chargeCount, payouts, txns: txns.slice(0, 200) });
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
          .select("session_id,event,path")
          .gte("ts", dayStart.toISOString())
          .limit(50000);
        const sessionsToday = new Set<string>();
        let viewsToday = 0;
        const pages = new Map<string, number>();
        for (const e of today ?? []) {
          if (e.event === "page_view") {
            sessionsToday.add(e.session_id);
            viewsToday++;
            pages.set(e.path ?? "?", (pages.get(e.path ?? "?") ?? 0) + 1);
          }
        }
        return NextResponse.json({
          liveVisitors: [...live.values()],
          liveCount: live.size,
          sessionsToday: sessionsToday.size,
          viewsToday,
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
        const { code, kind, value, maxRedemptions, expiresAt } = body as {
          code: string; kind: "percent" | "amount"; value: number;
          maxRedemptions?: number; expiresAt?: string;
        };
        const clean = String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
        if (!clean || !value || value <= 0) throw new Error("Code and a positive value are required");
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
        });
        const { data, error } = await db
          .from("discount_codes")
          .insert({
            code: clean,
            stripe_coupon_id: coupon.id,
            stripe_promo_id: promo.id,
            percent_off: kind === "percent" ? value : null,
            amount_off_cents: kind === "amount" ? Math.round(value) : null,
            max_redemptions: maxRedemptions ?? null,
            expires_at: expiresAt || null,
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
        const StripeLib = (await import("stripe")).default;
        const stripe = new StripeLib(process.env.STRIPE_SECRET_KEY!);
        await stripe.promotionCodes.update(row.stripe_promo_id, { active: Boolean(active) });
        await db.from("discount_codes").update({ active: Boolean(active) }).eq("id", id);
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
