import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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

  // shipping labels/rates are editable from the admin Settings page
  const { data: settingsRows } = await supabase.from("site_settings").select("key,value");
  const settings = Object.fromEntries((settingsRows ?? []).map((s) => [s.key, s.value]));
  const intlCents = Math.max(0, parseInt(settings.shipping_intl_cents ?? "1500", 10) || 1500);
  const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
    { shipping_rate_data: { display_name: settings.shipping_free_label ?? "Free Shipping (Australia)", type: "fixed_amount", fixed_amount: { amount: 0, currency: "aud" } } },
    { shipping_rate_data: { display_name: settings.shipping_intl_label ?? "International Shipping", type: "fixed_amount", fixed_amount: { amount: intlCents, currency: "aud" } } },
  ];

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: ["AU", "FR", "US", "GB", "CA", "NZ", "DE", "BE", "NL", "CH", "IT", "ES", "PT", "IE", "BR", "JP"],
    },
    shipping_options: shippingOptions,
    metadata: {
      cart: JSON.stringify(items.map((i) => ({ v: i.variantId, q: i.qty }))),
    },
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
  });

  return NextResponse.json({ url: session.url });
}
