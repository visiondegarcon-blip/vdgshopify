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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const cart: { v: number; q: number }[] = JSON.parse(session.metadata?.cart ?? "[]");
    const email = session.customer_details?.email ?? "unknown";

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
      await admin.rpc("decrement_stock", { v_id: c.v, qty: c.q });
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
