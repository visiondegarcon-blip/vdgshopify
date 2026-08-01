import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { validateDiscount, type DiscountRow } from "@/lib/discounts";
import { quoteShipping } from "@/lib/shipping";

// Server-side: validates prices/stock from the DB, never trusts the client.
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Payments not configured yet (missing Stripe key)." },
      { status: 500 }
    );
  }
  const stripe = new Stripe(stripeKey);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const body = await req.json().catch(() => null);
  const items: { variantId: number; qty: number }[] = body?.items ?? [];
  if (!items.length) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const ids = items.map((i) => i.variantId);
  const { data: variants, error } = await supabase
    .from("variants")
    .select("id,title,price_cents,stock,products(title,handle)")
    .in("id", ids);
  if (error || !variants) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) return NextResponse.json({ error: "Item not found" }, { status: 400 });
    const qty = Math.max(1, Math.min(10, Math.floor(item.qty)));
    if (v.stock < qty)
      return NextResponse.json(
        { error: `${(v.products as unknown as { title: string })?.title ?? "Item"} (${v.title}) is sold out or has insufficient stock.` },
        { status: 400 }
      );
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "aud",
        unit_amount: v.price_cents,
        product_data: {
          name: `${(v.products as unknown as { title: string })?.title ?? "VDG"} — ${v.title}`,
        },
      },
    });
  }

  /* Shipping is priced by destination region + cart weight. The shopper picks
     their country on the cart page (Stripe Checkout can't re-price shipping
     from the address typed into it), and we re-quote here from the DB rather
     than trusting any amount the client sends. */
  const country = typeof body?.country === "string" ? body.country.toUpperCase() : "";
  const requestedService = body?.shipping_service === "express" ? "express" : "standard";
  if (!country) return NextResponse.json({ error: "Choose a delivery country first." }, { status: 400 });

  const quotes = await quoteShipping(country, items);
  if (!quotes.length)
    return NextResponse.json({ error: "We don't ship to that country yet." }, { status: 400 });
  const chosen = quotes.find((q) => q.service === requestedService) ?? quotes[0];

  let shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
    {
      shipping_rate_data: {
        display_name: chosen.label,
        type: "fixed_amount",
        fixed_amount: { amount: chosen.priceCents, currency: "aud" },
      },
    },
  ];

  // cart-page discount code (validated server-side; anti-abuse checks inside)
  const sid = typeof body?.sid === "string" ? body.sid.slice(0, 64) : "";
  const subtotal = lineItems.reduce((n, li) => n + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1), 0);
  let discount: DiscountRow | null = null;
  if (typeof body?.discount_code === "string" && body.discount_code.trim()) {
    const result = await validateDiscount(body.discount_code, subtotal, sid);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    discount = result.row;
    if (discount.kind === "free_shipping") {
      shippingOptions = [
        {
          shipping_rate_data: {
            display_name: `Free shipping — ${discount.code}`,
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "aud" },
          },
        },
      ];
    }
  }
  const priceDiscount = discount && discount.kind !== "free_shipping" && discount.stripe_coupon_id;

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    // Pinned to the country the rate was quoted for — otherwise a shopper
    // could take an Australia rate and then ship the parcel to Europe.
    shipping_address_collection: {
      allowed_countries: [country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry],
    },
    shipping_options: shippingOptions,
    // Stripe forbids combining pre-applied discounts with the promo-code box
    ...(priceDiscount
      ? { discounts: [{ coupon: discount!.stripe_coupon_id! }] }
      : discount
        ? {}
        : { allow_promotion_codes: true }),
    metadata: {
      cart: JSON.stringify(items.map((i) => ({ v: i.variantId, q: i.qty }))),
      sid,
      ...(discount ? { discount_code_id: String(discount.id), discount_code: discount.code } : {}),
    },
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
  });

  return NextResponse.json({ url: session.url });
}
