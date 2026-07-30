import { createClient } from "@supabase/supabase-js";

/* Server-side discount validation shared by /api/validate-discount and
   /api/checkout. Uses the service role (discount tables are RLS-locked).
   Anti-abuse checks are cookie/session-id based (sid), plus email recorded
   at webhook time for the audit trail. */

export type DiscountRow = {
  id: number;
  code: string;
  kind: "percent" | "amount" | "free_shipping" | "stripe";
  stripe_coupon_id: string | null;
  percent_off: number | null;
  amount_off_cents: number | null;
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number | null;
  uses: number;
  restrictions: { min_order_cents?: number; first_order_only?: boolean; one_per_customer?: boolean };
};

export function serviceDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export function describeDiscount(d: DiscountRow): string {
  if (d.kind === "free_shipping") return "Free shipping";
  if (d.percent_off) return `${d.percent_off}% off`;
  if (d.amount_off_cents) return `$${(d.amount_off_cents / 100).toFixed(2)} off`;
  return "Discount";
}

export async function validateDiscount(
  code: string,
  subtotalCents: number,
  sid: string
): Promise<{ row: DiscountRow } | { error: string }> {
  const clean = String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
  if (!clean) return { error: "Enter a code." };
  const db = serviceDb();
  const { data: row } = await db.from("discount_codes").select("*").eq("code", clean).maybeSingle();
  if (!row || !row.active) return { error: "That code isn't valid." };
  const d = row as DiscountRow;
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return { error: "That code has expired." };
  const redeemed = Math.max(d.uses ?? 0, d.times_redeemed ?? 0);
  if (d.max_redemptions && redeemed >= d.max_redemptions) return { error: "That code has been fully redeemed." };
  const r = d.restrictions ?? {};
  if (r.min_order_cents && subtotalCents < r.min_order_cents)
    return { error: `This code needs a minimum order of $${(r.min_order_cents / 100).toFixed(2)}.` };
  if (sid) {
    if (r.one_per_customer) {
      const { data: prior } = await db
        .from("discount_redemptions")
        .select("id")
        .eq("code_id", d.id)
        .eq("sid", sid)
        .limit(1);
      if (prior?.length) return { error: "You've already used this code." };
    }
    if (r.first_order_only) {
      const { data: bought } = await db
        .from("events")
        .select("id")
        .eq("session_id", sid)
        .eq("event", "purchase")
        .limit(1);
      if (bought?.length) return { error: "This code is for first orders only." };
    }
  }
  return { row: d };
}
