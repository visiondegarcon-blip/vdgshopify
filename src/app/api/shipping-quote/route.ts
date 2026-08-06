import { NextRequest, NextResponse } from "next/server";
import { quoteShipping, shippableCountries } from "@/lib/shipping";
import { rateLimit } from "@/lib/rateLimit";

/* Cart page asks for live shipping options once the shopper picks a country.
   Stripe Checkout can't recalculate shipping from the address the shopper
   types in, so the destination has to be chosen here first — the resulting
   rate is what gets handed to Stripe. */

export async function GET() {
  return NextResponse.json({ countries: await shippableCountries() });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: "shipping-quote", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const country = typeof body?.country === "string" ? body.country : "";
  const items: { variantId: number; qty: number }[] = Array.isArray(body?.items) ? body.items : [];
  /* The admin's rate checker prices a hypothetical weight with no real cart.
     It's read-only — it returns prices that are already public on the cart
     page — so it needs no auth. */
  const weightG = Number(body?.weightG);
  const preview = Number.isFinite(weightG) && weightG >= 0 && !items.length;

  if (!country) return NextResponse.json({ error: "Pick a delivery country" }, { status: 400 });
  if (!items.length && !preview) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const quotes = await quoteShipping(country, items, preview ? weightG : undefined);
  if (!quotes.length) {
    return NextResponse.json(
      { error: "We don't ship to that country yet.", quotes: [] },
      { status: 200 }
    );
  }
  return NextResponse.json({ quotes });
}
