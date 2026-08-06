import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { validateDiscount, type DiscountRow } from "@/lib/discounts";
import { quoteShipping } from "@/lib/shipping";
import { rateLimit } from "@/lib/rateLimit";
import { getOrSetGuardId } from "@/lib/guardId";

// Server-side: validates prices/stock from the DB, never trusts the client.
export async function POST(req: NextRequest) {
  // each hit can create a Stripe session; throttle to blunt flooding
  const limited = rateLimit(req, { key: "checkout", limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !serviceKey) {
    return NextResponse.json(
      { error: "Payments not configured yet (missing key)." },
      { status: 500 }
    );
  }
  const stripe = new Stripe(stripeKey);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // reserve_stock/release_stock are locked to service_role (an anon-callable
  // version would let anyone grief inventory to zero via a direct RPC call,
  // bypassing this route's checks entirely) — see migration
  // "revoke_public_exec_reserve_release_stock".
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  const body = await req.json().catch(() => null);
  const items: { variantId: number; qty: number }[] = body?.items ?? [];
  if (!items.length) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const ids = items.map((i) => i.variantId);
  const { data: variants, error } = await supabase
    .from("variants")
    .select("id,title,price_cents,stock,products(title,handle,status)")
    .in("id", ids);
  if (error || !variants) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const normalizedQty = new Map<number, number>();
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) return NextResponse.json({ error: "Item not found" }, { status: 400 });
    // never let a draft/hidden product be bought by posting its variant id
    // directly — only live products are purchasable
    const prod = v.products as unknown as { title: string; status?: string } | null;
    if (!prod || prod.status !== "active")
      return NextResponse.json({ error: "That item isn't available." }, { status: 400 });
    const qty = Math.max(1, Math.min(10, Math.floor(item.qty) || 1));
    normalizedQty.set(v.id, qty);
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

  /* Reserve stock atomically now, rather than only checking-then-decrementing
     later at the webhook — the old check-at-checkout/decrement-at-webhook
     split let two shoppers both pass the check and both pay for the last
     unit. reserve_stock is a single `UPDATE ... WHERE stock >= qty`, so under
     concurrent requests only one can win the last unit; the loser gets a
     clean "sold out" instead of an oversold order. If any item in a
     multi-item cart fails, everything already reserved this request is
     rolled back so a cart never partially holds stock. */
  const reserved: { id: number; qty: number }[] = [];
  for (const [variantId, qty] of normalizedQty) {
    const { data: ok, error: rErr } = await admin.rpc("reserve_stock", { v_id: variantId, qty });
    if (rErr || !ok) {
      await Promise.all(reserved.map((r) => admin.rpc("release_stock", { v_id: r.id, qty: r.qty })));
      const v = variants.find((x) => x.id === variantId);
      const title = (v?.products as unknown as { title: string })?.title ?? "Item";
      return NextResponse.json(
        { error: `${title}${v ? ` (${v.title})` : ""} is sold out or has insufficient stock.` },
        { status: 400 }
      );
    }
    reserved.push({ id: variantId, qty });
  }
  // if anything below fails, give the stock back rather than leaving it
  // stuck in limbo (including any unexpected throw — belt and braces, since
  // there's otherwise no Stripe session around to ever expire and release it)
  const releaseAll = () =>
    Promise.all(reserved.map((r) => admin.rpc("release_stock", { v_id: r.id, qty: r.qty })));

  try {
    return await finishCheckout();
  } catch (e) {
    await releaseAll();
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start checkout." },
      { status: 500 }
    );
  }

  async function finishCheckout(): Promise<NextResponse> {
    /* Shipping is priced by destination region + cart weight. The shopper
       picks their country on the cart page (Stripe Checkout can't re-price
       shipping from the address typed into it), and we re-quote here from
       the DB rather than trusting any amount the client sends. */
    const country = typeof body?.country === "string" ? body.country.toUpperCase() : "";
    const requestedService = body?.shipping_service === "express" ? "express" : "standard";
    if (!country) {
      await releaseAll();
      return NextResponse.json({ error: "Choose a delivery country first." }, { status: 400 });
    }

    const quotes = await quoteShipping(country, items);
    if (!quotes.length) {
      await releaseAll();
      return NextResponse.json({ error: "We don't ship to that country yet." }, { status: 400 });
    }
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
    const guardId = await getOrSetGuardId();
    const subtotal = lineItems.reduce((n, li) => n + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1), 0);
    let discount: DiscountRow | null = null;
    if (typeof body?.discount_code === "string" && body.discount_code.trim()) {
      const result = await validateDiscount(body.discount_code, subtotal, guardId);
      if ("error" in result) {
        await releaseAll();
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
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
        // reflects what was actually reserved (normalized qty), not the raw
        // client-sent quantities
        cart: JSON.stringify(Array.from(normalizedQty, ([v, q]) => ({ v, q }))),
        sid,
        gid: guardId,
        ...(discount ? { discount_code_id: String(discount.id), discount_code: discount.code } : {}),
      },
      // Stock is reserved the moment this session is created, so give it a
      // short leash — an abandoned checkout releases the hold in 30 minutes
      // via the checkout.session.expired webhook, rather than tying up
      // inventory for Stripe's 24h default.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    });

    return NextResponse.json({ url: session.url });
  }
}
