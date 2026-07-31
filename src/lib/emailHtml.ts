/* Email HTML renderer shared by the admin template editor (preview) and the
   server-side campaign sender. Kept framework-free so the API route can use it.
   Only email-safe font stacks — mail clients don't load webfonts reliably. */

export type Block =
  | { type: "logo" }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "button"; text: string; url: string };

export type EmailFont = "mono" | "serif" | "sans" | "times";

export const EMAIL_FONTS: Record<EmailFont, { label: string; head: string; body: string }> = {
  mono: { label: "Monospace (current look)", head: "monospace", body: "Georgia,serif" },
  serif: { label: "Serif (Georgia)", head: "Georgia,serif", body: "Georgia,serif" },
  sans: { label: "Sans-serif (Arial)", head: "Arial,Helvetica,sans-serif", body: "Arial,Helvetica,sans-serif" },
  times: { label: "Times", head: "'Times New Roman',Times,serif", body: "'Times New Roman',Times,serif" },
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const safeUrl = (u: string) => (/^https?:\/\/|^\//.test(u.trim()) ? escapeHtml(u.trim()) : "#");

export function blocksToHtml(blocks: Block[], font: EmailFont = "mono"): string {
  const f = EMAIL_FONTS[font] ?? EMAIL_FONTS.mono;
  const parts = blocks.map((b) => {
    switch (b.type) {
      case "logo":
        return `<tr><td align="center" style="padding:24px 0"><img src="https://vdg-store.vercel.app/site/logo-black.png" height="120" alt="VDG"/></td></tr>`;
      case "heading":
        return `<tr><td align="center" style="padding:8px 24px;font-family:${f.head};font-size:22px;font-weight:bold;letter-spacing:3px">${escapeHtml(b.text)}</td></tr>`;
      case "text":
        return `<tr><td style="padding:8px 24px;font-family:${f.body};font-size:14px;line-height:1.7">${escapeHtml(b.text).replace(/\n/g, "<br/>")}</td></tr>`;
      case "image":
        return b.url
          ? `<tr><td align="center" style="padding:8px 0"><img src="${safeUrl(b.url)}" width="100%" style="max-width:552px" alt=""/></td></tr>`
          : "";
      case "button":
        return `<tr><td align="center" style="padding:16px"><a href="${safeUrl(b.url)}" style="background:#000;color:#fff;padding:12px 28px;font-family:${f.head};font-size:13px;text-decoration:none;letter-spacing:2px">${escapeHtml(b.text)}</a></td></tr>`;
    }
  });
  return `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff">${parts.join("")}
<tr><td align="center" style="padding:28px 24px;font-family:${f.head};font-size:10px;color:#999">Vision De Garçon · You're receiving this because you signed up at visiondegarcon.fr<br/><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></td></tr></table>`;
}

/* Plain-text alternative — improves deliverability and is required by some
   filters. Derived from the same blocks so the two can't drift apart. */
export function blocksToText(blocks: Block[]): string {
  const lines = blocks.flatMap((b) => {
    switch (b.type) {
      case "heading": return [b.text.toUpperCase(), ""];
      case "text": return [b.text, ""];
      case "button": return [`${b.text}: ${b.url}`, ""];
      default: return [];
    }
  });
  return `${lines.join("\n")}\nVision De Garçon — you're receiving this because you signed up at visiondegarcon.fr\nUnsubscribe: {{unsubscribe_url}}`;
}
