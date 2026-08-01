import { siteUrl } from "./resendSend";

/* Templates for the three automated emails: back-in-stock, abandoned cart,
   and the low-stock digest that goes to the shop owner rather than a
   customer. Plain inline-styled HTML — email clients ignore stylesheets. */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);

function shell(heading: string, inner: string, footer = "Merci for supporting the vision.") {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fff;color:#000;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6">
  <div style="max-width:520px;margin:0 auto">
    <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
    ${inner}
    <p style="margin:24px 0 0;font-size:12px;color:#666">${esc(footer)}<br>
      <a href="${siteUrl()}" style="color:#666">Vision De Garçon</a></p>
  </div>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:0 0 16px"><a href="${esc(href)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;font-weight:bold">${esc(label)}</a></p>`;

/* ---------------------------------------------------------------- restock */

export function restockEmail(input: {
  productTitle: string;
  variantTitle: string;
  handle: string;
}): { subject: string; html: string; text: string } {
  const url = `${siteUrl()}/products/${input.handle}`;
  const name = `${input.productTitle} (${input.variantTitle})`;
  return {
    subject: `${input.productTitle} is back in ${input.variantTitle}`,
    html: shell(
      "It's back.",
      `<p style="margin:0 0 16px">You asked us to let you know when <strong>${esc(name)}</strong> was back in stock. It is — but stock is limited and we're not holding it.</p>
       ${button(url, "Shop it now")}
       <p style="margin:0 0 16px;font-size:12px;color:#666">You're getting this because you signed up for a restock alert on this item. It's a one-off — there's nothing to unsubscribe from.</p>`
    ),
    text: [
      "It's back.",
      "",
      `You asked to be told when ${name} was back in stock. It is — but stock is limited.`,
      "",
      url,
      "",
      "You're getting this because you signed up for a restock alert on this item. It's a one-off.",
    ].join("\n"),
  };
}

/* -------------------------------------------------------- abandoned cart */

export function abandonedCartEmail(input: {
  items: { name: string; quantity: number }[];
  totalCents: number;
  currency?: string;
  resumeUrl?: string | null;
  unsubscribeUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const url = input.resumeUrl || `${siteUrl()}/store`;
  const lines = input.items.map((i) => `${i.quantity}× ${i.name}`);
  const listHtml = lines.length
    ? `<p style="margin:0 0 16px">${lines.map(esc).join("<br>")}</p>`
    : "";
  const totalHtml = input.totalCents
    ? `<p style="margin:0 0 16px">Total: <strong>${money(input.totalCents, input.currency?.toUpperCase() || "AUD")}</strong></p>`
    : "";
  const unsub = input.unsubscribeUrl
    ? `<p style="margin:16px 0 0;font-size:12px;color:#666"><a href="${esc(input.unsubscribeUrl)}" style="color:#666">Unsubscribe</a></p>`
    : "";

  return {
    subject: "You left something behind",
    html: shell(
      "Still thinking it over?",
      `<p style="margin:0 0 16px">You started checking out but didn't finish. We've kept your cart — pick up right where you left off.</p>
       ${listHtml}${totalHtml}
       ${button(url, "Finish checkout")}
       <p style="margin:0 0 16px;font-size:12px;color:#666">Pieces sell out and we don't restock everything, so don't sit on it too long.</p>
       ${unsub}`
    ),
    text: [
      "Still thinking it over?",
      "",
      "You started checking out but didn't finish. Your cart is still here.",
      ...(lines.length ? ["", ...lines] : []),
      ...(input.totalCents ? ["", `Total: ${money(input.totalCents, input.currency?.toUpperCase() || "AUD")}`] : []),
      "",
      url,
      ...(input.unsubscribeUrl ? ["", `Unsubscribe: ${input.unsubscribeUrl}`] : []),
    ].join("\n"),
  };
}

/* ------------------------------------------------ low stock (to the owner) */

export function lowStockEmail(input: {
  threshold: number;
  rows: { product: string; variant: string; stock: number }[];
}): { subject: string; html: string; text: string } {
  const out = input.rows.filter((r) => r.stock === 0);
  const low = input.rows.filter((r) => r.stock > 0);
  const line = (r: { product: string; variant: string; stock: number }) =>
    `${r.product} — ${r.variant}: ${r.stock === 0 ? "SOLD OUT" : `${r.stock} left`}`;

  const section = (title: string, rows: typeof input.rows) =>
    rows.length
      ? `<p style="margin:0 0 8px;font-weight:bold">${esc(title)}</p>
         <p style="margin:0 0 16px">${rows.map((r) => esc(line(r))).join("<br>")}</p>`
      : "";

  return {
    subject:
      out.length && low.length
        ? `${out.length} sold out, ${low.length} running low`
        : out.length
          ? `${out.length} ${out.length === 1 ? "variant is" : "variants are"} sold out`
          : `${low.length} ${low.length === 1 ? "variant is" : "variants are"} running low`,
    html: shell(
      "Stock check",
      `${section("Sold out", out)}${section(`At or below ${input.threshold}`, low)}
       ${button(`${siteUrl()}/admin/products`, "Open products")}
       <p style="margin:0 0 16px;font-size:12px;color:#666">You'll only get told once per item — this won't repeat daily until it's restocked and drops low again.</p>`,
      "Automated stock alert from your VDG admin."
    ),
    text: [
      "Stock check",
      ...(out.length ? ["", "Sold out:", ...out.map(line)] : []),
      ...(low.length ? ["", `At or below ${input.threshold}:`, ...low.map(line)] : []),
      "",
      `${siteUrl()}/admin/products`,
      "",
      "You'll only get told once per item until it's restocked.",
    ].join("\n"),
  };
}
