import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Public signup endpoint used by the countdown lock and the scroll popup.
   Inserts into subscribers (service role; table has no public policies) and
   returns the popup's discount code when the source is the popup. */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const source = ["popup", "countdown"].includes(body?.source) ? body.source : "popup";
  const sid = typeof body?.sid === "string" ? body.sid.slice(0, 64) : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (phone && !/^[+\d][\d\s()-]{5,20}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await db
    .from("subscribers")
    .upsert(
      { email, phone: phone || null, source, unsubscribed_at: null },
      { onConflict: "email" }
    );
  if (error) return NextResponse.json({ error: "Could not sign you up." }, { status: 500 });

  if (sid) {
    await db.from("events").insert({
      session_id: sid,
      event: source === "popup" ? "popup_signup" : "lock_signup",
      path: null,
      meta: {},
    });
  }

  let discountCode: string | null = null;
  if (source === "popup") {
    const { data } = await db.from("site_settings").select("value").eq("key", "popup_config").maybeSingle();
    try {
      discountCode = JSON.parse(data?.value ?? "{}").discount_code || null;
    } catch {}
  }
  return NextResponse.json({ ok: true, discount_code: discountCode });
}
