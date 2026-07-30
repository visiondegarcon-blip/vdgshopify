import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* One-click unsubscribe target used in every campaign footer
   (Australian Spam Act requirement). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  let message = "Invalid unsubscribe link.";
  if (/^[a-f0-9]{32}$/.test(token)) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await db
      .from("subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("email")
      .maybeSingle();
    message = data ? "You have been unsubscribed. No more emails from us." : "Invalid unsubscribe link.";
  }
  return new NextResponse(
    `<!doctype html><html><body style="font-family:monospace;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><div style="letter-spacing:3px;font-weight:bold">VISION DE GARÇON</div><p style="margin-top:16px;opacity:.8">${message}</p></div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
