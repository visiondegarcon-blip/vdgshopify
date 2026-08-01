import { NextRequest, NextResponse } from "next/server";
import { quoteShipping, shippableCountries } from "@/lib/shipping";

/* Cart page asks for live shipping options once the shopper picks a country.
   Stripe Checkout can't recalculate shipping from the address the shopper
   types in, so the destination has to be chosen here first — the resulting
   rate is what gets handed to Stripe. */

export async function GET() {
  return NextResponse.json({ countries: await shippableCountries() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const country = typeof body?.country === "string" ? body.country : "";
  const items: { variantId: number; qty: number }[] = Array.isArray(body?.items) ? body.items : [];
  if (!country) return NextResponse.json({ error: "Pick a delivery country" }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const quotes = await quoteShipping(country, items);
  if (!quotes.length) {
    return NextResponse.json(
      { error: "We don't ship to that country yet.", quotes: [] },
      { status: 200 }
    );
  }
  return NextResponse.json({ quotes });
}
