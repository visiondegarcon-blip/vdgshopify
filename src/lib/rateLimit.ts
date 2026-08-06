import { NextRequest, NextResponse } from "next/server";

/* Lightweight in-process rate limiter.

   On Vercel each warm serverless instance keeps its own counters, so this is a
   best-effort throttle rather than a globally-consistent one — but it still
   meaningfully blunts single-IP bursts (discount-code brute forcing, signup
   spam, checkout-session flooding) with zero extra infrastructure. For a hard
   global guarantee, back this with Upstash/Redis later.

   Fails OPEN: any internal error lets the request through rather than breaking
   the store. */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number }
): NextResponse | null {
  try {
    // bound memory: sweep expired entries if the map grows large
    if (buckets.size > 5000) {
      const t = Date.now();
      for (const [k, v] of buckets) if (t > v.resetAt) buckets.delete(k);
    }

    const id = `${opts.key}:${clientIp(req)}`;
    const now = Date.now();
    const hit = buckets.get(id);
    if (!hit || now > hit.resetAt) {
      buckets.set(id, { count: 1, resetAt: now + opts.windowMs });
      return null;
    }
    hit.count += 1;
    if (hit.count > opts.limit) {
      const retry = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
      return NextResponse.json(
        { error: "Too many requests — slow down and try again shortly." },
        { status: 429, headers: { "retry-after": String(retry) } }
      );
    }
    return null;
  } catch {
    return null; // fail open — never let the limiter itself break a request
  }
}
