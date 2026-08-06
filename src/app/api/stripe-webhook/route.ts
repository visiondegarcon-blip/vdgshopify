import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe calls this after payment. Uses the service-role key (server only)
// to record the order and decrement stock atomically.
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !webhookSecret || !serviceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const stripe = new Stripe(stripeKey);

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig!, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.expired") {
    // stock was reserved atomically when the checkout session was created
    // (see /api/checkout); if the shopper never paid, give it back rather
    // than leaving it held for Stripe's session lifetime.
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
    const cart: { v: number; q: number }[] = JSON.parse(session.metadata?.cart ?? "[]");
    await Promise.all(cart.map((c) => admin.rpc("release_stock", { v_id: c.v, qty: c.q })));
    return NextResponse.json({ ok: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const cart: { v: number; q: number }[] = JSON.parse(session.metadata?.cart ?? "[]");
    const email = session.customer_details?.email ?? "unknown";
    const guardId = session.metadata?.gid || null;

    // link to an auth user if one exists with this email
    let userId: string | null = null;
    const { data: users } = await admin.auth.admin.listUsers();
    const match = users?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) userId = match.id;

    const { data: order, error } = await admin
      .from("orders")
      .insert({
        user_id: userId,
        email,
        stripe_session_id: session.id,
        total_cents: session.amount_total ?? 0,
        currency: (session.currency ?? "aud").toUpperCase(),
        status: "paid",
        shipping_name: session.customer_details?.name ?? null,
        shipping_address: session.customer_details?.address ?? null,
        discount_cents: session.total_details?.amount_discount ?? 0,
        guard_id: guardId,
      })
      .select()
      .single();

    if (error) {
      // duplicate webhook delivery — order already recorded
      if (error.code === "23505") return NextResponse.json({ ok: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = cart.map((c) => c.v);
    const { data: variants } = await admin
      .from("variants")
      .select("id,title,price_cents,products(title)")
      .in("id", ids);

    // Stock was already reserved (decremented) atomically when the checkout
    // session was created — see /api/checkout's reserve_stock call. Doing it
    // again here would double-decrement every paid order.
    for (const c of cart) {
      const v = variants?.find((x) => x.id === c.v);
      await admin.from("order_items").insert({
        order_id: order.id,
        variant_id: c.v,
        product_title: (v?.products as unknown as { title: string })?.title ?? "",
        variant_title: v?.title ?? "",
        quantity: c.q,
        unit_price_cents: v?.price_cents ?? 0,
      });
    }

    // record discount redemption for anti-abuse limits (one-per-customer etc.)
    // — keyed on the server-issued guard id, not the client-rotatable sid
    const codeId = Number(session.metadata?.discount_code_id);
    if (codeId) {
      await admin.from("discount_redemptions").insert({
        code_id: codeId,
        email,
        sid: guardId,
        order_id: order.id,
      });
      const { data: dc } = await admin.from("discount_codes").select("uses").eq("id", codeId).single();
      await admin.from("discount_codes").update({ uses: (dc?.uses ?? 0) + 1 }).eq("id", codeId);
    }

    // server-authoritative purchase event for analytics, tied to the
    // storefront session via checkout metadata
    const sid = session.metadata?.sid;
    if (sid) {
      await admin.from("events").insert({
        session_id: sid,
        event: "purchase",
        path: "/success",
        device: null,
        meta: { order_id: order.id, total_cents: session.amount_total ?? 0 },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
