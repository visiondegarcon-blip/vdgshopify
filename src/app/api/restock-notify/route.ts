import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";

/* "Email me when this is back" on a sold-out variant.
 *
 * Uses the service role because the requests table is deliberately not
 * readable by anon — a public list of who wants what would leak customer
 * emails. Inserts are idempotent per (variant, email) while a request is
 * still pending, so double-clicking the button can't spam the list. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "restock-notify", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const variantId = Number(body?.variantId);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!variantId || !Number.isFinite(variantId))
    return NextResponse.json({ error: "Pick a size first." }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 254)
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const db = createClient(url, key);

  // Only accept requests for variants that are genuinely out of stock —
  // otherwise the customer would wait for an email that never comes.
  const { data: variant } = await db
    .from("variants")
    .select("id,stock")
    .eq("id", variantId)
    .maybeSingle();
  if (!variant) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  if (variant.stock > 0)
    return NextResponse.json({ error: "Good news — this is back in stock now." }, { status: 409 });

  const { error } = await db.from("restock_requests").insert({ variant_id: variantId, email });
  // 23505 = the partial unique index: they're already on the list, which from
  // the customer's point of view is exactly the outcome they wanted.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not save that, try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
