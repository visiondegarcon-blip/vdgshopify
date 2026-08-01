import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDailyAutomations } from "@/lib/retention";

/* Daily sweep: abandoned-cart nudges + the low-stock digest.
 *
 * Vercel's Hobby plan allows one scheduled run per day, so everything
 * scheduled lives behind this single endpoint. Both sweeps are written to be
 * safe to run repeatedly — they each track what they've already handled — so
 * the admin's "Run now" button can call the same code any time. */

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  /* Vercel sends `Authorization: Bearer $CRON_SECRET` on its own cron calls.
     This fails CLOSED on purpose: with no secret configured the endpoint
     refuses to run rather than letting any stranger trigger a send and burn
     the daily email quota. */
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const result = await runDailyAutomations(createClient(url, key));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sweep failed" },
      { status: 500 }
    );
  }
}
