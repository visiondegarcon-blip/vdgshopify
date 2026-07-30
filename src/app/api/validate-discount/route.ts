import { NextRequest, NextResponse } from "next/server";
import { describeDiscount, validateDiscount } from "@/lib/discounts";

// Cart-page "Apply" button: tells the shopper whether a code is valid
// before checkout. The checkout route re-validates server-side regardless.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const subtotal = Math.max(0, Math.round(Number(body?.subtotalCents) || 0));
  const sid = typeof body?.sid === "string" ? body.sid.slice(0, 64) : "";
  const result = await validateDiscount(String(body?.code ?? ""), subtotal, sid);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, description: describeDiscount(result.row), code: result.row.code });
}
