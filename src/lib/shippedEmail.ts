import { siteUrl } from "./resendSend";

/* The "your order is on its way" email.
 *
 * Tracking is optional on purpose: if the admin hasn't got a consignment
 * number yet (or the carrier doesn't provide one), the email still goes out
 * and simply promises a delivery window instead of showing a dead tracking
 * field. */

export type ShippedEmailInput = {
  orderId: number;
  customerName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  etaText?: string;
  items?: { product_title: string; variant_title: string; quantity: number }[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Best-effort carrier link so the number is clickable. Australia Post covers
   the domestic case; anything unrecognised still shows the raw number. */
export function guessTrackingUrl(tracking: string): string | null {
  const t = tracking.trim();
  if (!t) return null;
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(t)) // UPU international format
    return `https://auspost.com.au/mypost/track/details/${encodeURIComponent(t)}`;
  if (/^\d{8,}$|^[A-Z0-9]{10,}$/i.test(t))
    return `https://auspost.com.au/mypost/track/details/${encodeURIComponent(t)}`;
  return null;
}

export function shippedEmail(input: ShippedEmailInput): { subject: string; html: string; text: string } {
  const { orderId, customerName, trackingNumber, items } = input;
  const eta = input.etaText || "3–5 business days";
  const tracking = trackingNumber?.trim() || "";
  const url = tracking ? input.trackingUrl?.trim() || guessTrackingUrl(tracking) : null;
  const greeting = customerName?.trim() ? `Hi ${esc(customerName.trim())},` : "Hi,";

  const itemLines = (items ?? [])
    .map((i) => `${i.quantity}× ${i.product_title} (${i.variant_title})`)
    .filter(Boolean);

  const subject = `Your VDG order #${orderId} has shipped`;

  const trackingBlockHtml = tracking
    ? `<p style="margin:0 0 16px">Tracking number:<br>
         ${url
           ? `<a href="${esc(url)}" style="font-family:monospace;font-size:16px;font-weight:bold;color:#000">${esc(tracking)}</a>`
           : `<span style="font-family:monospace;font-size:16px;font-weight:bold">${esc(tracking)}</span>`}
       </p>`
    : `<p style="margin:0 0 16px">Estimated delivery: <strong>${esc(eta)}</strong>.</p>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff;color:#000;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6">
  <div style="max-width:520px;margin:0 auto">
    <h1 style="font-size:20px;margin:0 0 16px">Your order is on its way</h1>
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 16px">Order <strong>#${orderId}</strong> has been shipped.</p>
    ${trackingBlockHtml}
    ${itemLines.length ? `<p style="margin:0 0 16px">${itemLines.map(esc).join("<br>")}</p>` : ""}
    <p style="margin:24px 0 0;font-size:12px;color:#666">Merci for supporting the vision.<br>
      <a href="${siteUrl()}" style="color:#666">Vision De Garçon</a></p>
  </div>
</body></html>`;

  const text = [
    greeting,
    "",
    `Order #${orderId} has been shipped.`,
    tracking ? `Tracking number: ${tracking}${url ? `\n${url}` : ""}` : `Estimated delivery: ${eta}.`,
    ...(itemLines.length ? ["", ...itemLines] : []),
    "",
    "Merci for supporting the vision.",
    siteUrl(),
  ].join("\n");

  return { subject, html, text };
}
