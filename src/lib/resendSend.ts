/* Resend sending. We keep the subscriber list and unsubscribe tokens in our own
   database (see /unsubscribe), so campaigns go out through the plain email API
   with a per-recipient unsubscribe link rather than Resend Audiences.
   Free tier allows 100 emails/day, 3,000/month — plenty at current list size;
   if the list outgrows that, switch to Resend Broadcasts (needs a full-access
   key and contacts synced into a Resend audience). */

export const DEFAULT_FROM = "Vision De Garçon <onboarding@resend.dev>";
const BATCH_LIMIT = 100; // Resend's max per /emails/batch call

export type Recipient = { email: string; unsubscribeToken: string | null };

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://vdg-store.vercel.app").replace(/\/$/, "");
}

export function unsubscribeUrl(token: string | null): string {
  return token ? `${siteUrl()}/unsubscribe?token=${encodeURIComponent(token)}` : `${siteUrl()}/`;
}

/* Resend rejects unverified sending domains with a clear message; translate the
   common failures into something readable in the admin UI. */
function friendlyError(status: number, message: string): string {
  if (/domain is not verified|not verified/i.test(message))
    return `${message} — add and verify your sending domain in Resend, then try again.`;
  if (status === 401 || /api key/i.test(message))
    return `Resend rejected the API key (${message}). Check RESEND_API_KEY.`;
  if (status === 429 || /rate|quota|limit/i.test(message))
    return `Resend rate/quota limit hit: ${message}. Free tier allows 100 emails/day.`;
  return message;
}

async function resendPost(path: string, payload: unknown) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email sending isn't configured yet (missing RESEND_API_KEY).");
  const res = await fetch(`https://api.resend.com/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string; data?: unknown[] };
  if (!res.ok) throw new Error(friendlyError(res.status, json?.message ?? `Resend error ${res.status}`));
  return json;
}

export async function sendOne(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  return resendPost("emails", {
    from: opts.from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

/* Sends one personalised copy per recipient, in batches. Returns how many were
   accepted by Resend plus any batch-level failures (we never fail the whole run
   because a later batch errored — earlier batches have already gone out). */
export async function sendCampaignEmails(opts: {
  from: string;
  subject: string;
  html: string;
  text: string;
  recipients: Recipient[];
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < opts.recipients.length; i += BATCH_LIMIT) {
    const chunk = opts.recipients.slice(i, i + BATCH_LIMIT);
    const payload = chunk.map((r) => {
      const url = unsubscribeUrl(r.unsubscribeToken);
      return {
        from: opts.from,
        to: [r.email],
        subject: opts.subject,
        html: opts.html.replaceAll("{{unsubscribe_url}}", url),
        text: opts.text.replaceAll("{{unsubscribe_url}}", url),
        // one-click unsubscribe headers — Gmail/Yahoo bulk-sender requirement
        headers: {
          "List-Unsubscribe": `<${url}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });
    try {
      await resendPost("emails/batch", payload);
      sent += chunk.length;
    } catch (e) {
      failed += chunk.length;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, failed, errors };
}
