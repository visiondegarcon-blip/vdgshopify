import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Ingestion endpoint for first-party analytics. Accepts small batches from
   sendBeacon; enriches with Vercel geo headers and a coarse device class.
   Inserts with the service role (events has RLS and no public policies). */

function deviceClass(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) return "mobile";
  if (/bot|crawl|spider|slurp/i.test(ua)) return "bot";
  if (!ua) return "other";
  return "desktop";
}

const ALLOWED = new Set([
  "page_view",
  "product_view",
  "add_to_cart",
  "variant_click",
  "checkout_started",
  "web_vital",
  "click",
  "popup_signup",
  "lock_signup",
]);

export async function POST(req: NextRequest) {
  let body: { events?: Record<string, unknown>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const incoming = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  if (!incoming.length) return NextResponse.json({ ok: true });

  const ua = req.headers.get("user-agent") ?? "";
  const device = deviceClass(ua);
  if (device === "bot") return NextResponse.json({ ok: true });
  const country = req.headers.get("x-vercel-ip-country");
  const city = req.headers.get("x-vercel-ip-city");

  const rows = incoming
    .filter((e) => typeof e.session_id === "string" && ALLOWED.has(String(e.event)))
    .map((e) => ({
      session_id: String(e.session_id).slice(0, 64),
      event: String(e.event),
      path: typeof e.path === "string" ? e.path.slice(0, 200) : null,
      device,
      country,
      city: city ? decodeURIComponent(city) : null,
      referrer: typeof e.referrer === "string" ? e.referrer.slice(0, 300) : null,
      meta: typeof e.meta === "object" && e.meta !== null ? e.meta : {},
    }));
  if (!rows.length) return NextResponse.json({ ok: true });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await db.from("events").insert(rows);

  // opportunistic retention: ~1% of requests prune events older than 180d
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 180 * 864e5).toISOString();
    await db.from("events").delete().lt("ts", cutoff);
  }
  return NextResponse.json({ ok: true });
}
