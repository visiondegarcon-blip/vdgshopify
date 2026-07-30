"use client";
import { useEffect, useState } from "react";
import { adminCall } from "../adminApi";

/* Marketing: scroll-popup builder, audience (subscribers), campaigns with a
   block-based email template maker. Campaign sending is a placeholder until
   an email provider is connected. */

type PopupCfg = {
  enabled: boolean; scroll_percent: number; heading: string; body: string; image: string;
  bg: string; fg: string; accent: string; discount_code: string; collect_phone: boolean;
};
const POPUP_DEFAULTS: PopupCfg = {
  enabled: false, scroll_percent: 30, heading: "JOIN THE VISION",
  body: "Sign up and get a discount code for your first order.",
  image: "", bg: "#000000", fg: "#ffffff", accent: "#FE0000", discount_code: "", collect_phone: false,
};

type Subscriber = {
  id: number; email: string; phone: string | null; source: string;
  consented_at: string; unsubscribed_at: string | null;
};

type Block =
  | { type: "logo" }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "button"; text: string; url: string };

type Template = { id: number; name: string; blocks: Block[] };
type Campaign = {
  id: number; name: string; subject: string; status: string; template_id: number | null;
  sent_at: string | null; email_templates: { name: string } | null;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const safeUrl = (u: string) => (/^https?:\/\/|^\//.test(u.trim()) ? escapeHtml(u.trim()) : "#");

export function blocksToHtml(blocks: Block[]): string {
  const parts = blocks.map((b) => {
    switch (b.type) {
      case "logo":
        return `<tr><td align="center" style="padding:24px 0"><img src="https://vdg-store.vercel.app/site/logo-black.png" height="120" alt="VDG"/></td></tr>`;
      case "heading":
        return `<tr><td align="center" style="padding:8px 24px;font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:3px">${escapeHtml(b.text)}</td></tr>`;
      case "text":
        return `<tr><td style="padding:8px 24px;font-family:Georgia,serif;font-size:14px;line-height:1.7">${escapeHtml(b.text).replace(/\n/g, "<br/>")}</td></tr>`;
      case "image":
        return b.url
          ? `<tr><td align="center" style="padding:8px 0"><img src="${safeUrl(b.url)}" width="100%" style="max-width:552px" alt=""/></td></tr>`
          : "";
      case "button":
        return `<tr><td align="center" style="padding:16px"><a href="${safeUrl(b.url)}" style="background:#000;color:#fff;padding:12px 28px;font-family:monospace;font-size:13px;text-decoration:none;letter-spacing:2px">${escapeHtml(b.text)}</a></td></tr>`;
    }
  });
  return `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff">${parts.join("")}
<tr><td align="center" style="padding:28px 24px;font-family:monospace;font-size:10px;color:#999">Vision De Garçon · You're receiving this because you signed up at visiondegarcon.fr<br/><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></td></tr></table>`;
}

export default function MarketingPage() {
  const [tab, setTab] = useState<"popup" | "audience" | "campaigns">("popup");

  // popup
  const [popup, setPopup] = useState<PopupCfg>(POPUP_DEFAULTS);
  const [popupMsg, setPopupMsg] = useState<string | null>(null);

  // audience
  const [subs, setSubs] = useState<Subscriber[] | null>(null);

  // campaigns
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [campMsg, setCampMsg] = useState<string | null>(null);

  useEffect(() => {
    adminCall<{ settings: Record<string, string> }>("get_settings").then((r) => {
      try {
        setPopup({ ...POPUP_DEFAULTS, ...JSON.parse(r.settings.popup_config ?? "{}") });
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (tab === "audience") adminCall<{ subscribers: Subscriber[] }>("list_subscribers").then((r) => setSubs(r.subscribers));
    if (tab === "campaigns") refreshCampaigns();
  }, [tab]);

  const refreshCampaigns = () => {
    adminCall<{ templates: Template[] }>("list_templates").then((r) => setTemplates(r.templates));
    adminCall<{ campaigns: Campaign[] }>("list_campaigns").then((r) => setCampaigns(r.campaigns));
  };

  const savePopup = async (next: PopupCfg) => {
    setPopup(next);
    await adminCall("update_settings", { settings: { popup_config: JSON.stringify(next) } });
    setPopupMsg("Saved — live on the store immediately.");
  };

  const exportSubs = () => {
    if (!subs) return;
    const lines = ["email,phone,source,consented_at,unsubscribed"];
    for (const s of subs)
      lines.push(`${s.email},${s.phone ?? ""},${s.source},${s.consented_at},${s.unsubscribed_at ? "yes" : "no"}`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "vdg-audience.csv";
    a.click();
  };

  const activeCount = subs?.filter((s) => !s.unsubscribed_at).length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Marketing</h1>
        <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
          {(["popup", "audience", "campaigns"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 capitalize ${tab === t ? "bg-[#1a1a1a] text-white" : ""}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "popup" && (
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_360px]">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Scroll signup popup</div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={popup.enabled} onChange={(e) => savePopup({ ...popup, enabled: e.target.checked })} />
                {popup.enabled ? "Live" : "Off"}
              </label>
            </div>
            {popupMsg && <p className="mt-1 text-xs text-green-700">{popupMsg}</p>}
            <div className="mt-4 grid gap-3">
              <label className="text-[12px]">
                Shows after scrolling {popup.scroll_percent}% of the page
                <input type="range" min={5} max={95} step={5} value={popup.scroll_percent}
                  onChange={(e) => setPopup({ ...popup, scroll_percent: Number(e.target.value) })}
                  onMouseUp={() => savePopup(popup)} onTouchEnd={() => savePopup(popup)}
                  className="mt-1 w-full" />
              </label>
              <label className="text-[12px]">Heading
                <input value={popup.heading} onChange={(e) => setPopup({ ...popup, heading: e.target.value })} onBlur={() => savePopup(popup)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              <label className="text-[12px]">Body
                <textarea value={popup.body} rows={2} onChange={(e) => setPopup({ ...popup, body: e.target.value })} onBlur={() => savePopup(popup)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              <label className="text-[12px]">Image URL (top of popup, optional)
                <input value={popup.image} onChange={(e) => setPopup({ ...popup, image: e.target.value })} onBlur={() => savePopup(popup)}
                  placeholder="/products/... or https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              <label className="text-[12px]">Discount code revealed after signup (create it under Discounts first)
                <input value={popup.discount_code} onChange={(e) => setPopup({ ...popup, discount_code: e.target.value.toUpperCase() })} onBlur={() => savePopup(popup)}
                  placeholder="VISION10"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm" />
              </label>
              <div className="flex items-end gap-4">
                {(["bg", "fg", "accent"] as const).map((k) => (
                  <label key={k} className="text-[12px]">
                    {k === "bg" ? "Background" : k === "fg" ? "Text" : "Accent"}
                    <input type="color" value={popup[k]} onChange={(e) => setPopup({ ...popup, [k]: e.target.value })} onBlur={() => savePopup(popup)}
                      className="mt-1 block h-8 w-14 cursor-pointer" />
                  </label>
                ))}
                <label className="flex items-center gap-1.5 pb-1 text-[12px]">
                  <input type="checkbox" checked={popup.collect_phone} onChange={(e) => savePopup({ ...popup, collect_phone: e.target.checked })} />
                  Phone field
                </label>
              </div>
            </div>
          </div>

          {/* live preview */}
          <div className="rounded-xl bg-gray-200 p-6 shadow-inner">
            <div className="text-center text-[11px] text-gray-500">Preview</div>
            <div className="mt-3 overflow-hidden shadow-2xl" style={{ background: popup.bg, color: popup.fg, borderRadius: 6 }}>
              {popup.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={popup.image} alt="" className="h-32 w-full object-cover" />
              )}
              <div className="p-5 text-center">
                <div className="font-mono text-lg font-bold tracking-widest">{popup.heading}</div>
                <p className="mt-2 text-xs opacity-80">{popup.body}</p>
                <div className="mt-3 border px-3 py-1.5 text-left text-xs opacity-60" style={{ borderColor: popup.fg }}>Email</div>
                {popup.collect_phone && (
                  <div className="mt-2 border px-3 py-1.5 text-left text-xs opacity-60" style={{ borderColor: popup.fg }}>Phone (optional)</div>
                )}
                <div className="mt-3 px-4 py-2 font-mono text-xs font-bold" style={{ background: popup.accent, color: popup.bg }}>SIGN UP</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "audience" && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <span className="text-2xl font-semibold">{activeCount}</span>
              <span className="ml-2 text-sm text-gray-500">subscribed</span>
            </div>
            <button onClick={exportSubs} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">Export CSV</button>
            <button
              onClick={async () => {
                const r = await adminCall<{ added: number; scanned: number }>("import_checkout_emails");
                alert(`Added ${r.added} new contacts from ${r.scanned} checkout emails.`);
                adminCall<{ subscribers: Subscriber[] }>("list_subscribers").then((x) => setSubs(x.subscribers));
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
            >
              Import checkout emails
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[12px] uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Phone</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Signed up</th><th className="px-4 py-2.5">Status</th><th></th></tr>
              </thead>
              <tbody>
                {subs?.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2">{s.phone ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{s.source}</td>
                    <td className="px-4 py-2">{new Date(s.consented_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      {s.unsubscribed_at
                        ? <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px]">Unsubscribed</span>
                        : <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-800">Subscribed</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={async () => { await adminCall("delete_subscriber", { id: s.id }); setSubs(subs.filter((x) => x.id !== s.id)); }} className="text-xs text-red-700 underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {subs && subs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No contacts yet — the popup and countdown lock feed this list.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-gray-400">
            SMS marketing: phone numbers are collected with consent but no SMS sender is connected — Australian
            Spam Act 2003 rules (consent, sender ID, unsubscribe) apply when you pick one later.
          </p>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="mt-4">
          {editing ? (
            <TemplateEditor
              template={editing}
              onClose={() => { setEditing(null); refreshCampaigns(); }}
            />
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing({ id: 0, name: "New template", blocks: [{ type: "logo" }, { type: "heading", text: "NEW DROP" }, { type: "text", text: "Something new just landed." }, { type: "button", text: "SHOP NOW", url: "https://vdg-store.vercel.app/store" }] })}
                  className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white"
                >
                  New template
                </button>
                <button
                  onClick={async () => {
                    const name = prompt("Campaign name?");
                    if (!name) return;
                    const subject = prompt("Email subject line?") ?? "";
                    const tpl = templates[0];
                    await adminCall("save_campaign", { name, subject, template_id: tpl?.id ?? null });
                    refreshCampaigns();
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm"
                >
                  New campaign
                </button>
              </div>
              {campMsg && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{campMsg}</p>}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold">Templates</div>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {templates.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50">
                        <span>{t.name}</span>
                        <span className="flex gap-2">
                          <button onClick={() => setEditing(t)} className="text-xs underline">Edit</button>
                          <button onClick={async () => { await adminCall("delete_template", { id: t.id }); refreshCampaigns(); }} className="text-xs text-red-700 underline">Delete</button>
                        </span>
                      </li>
                    ))}
                    {templates.length === 0 && <li className="text-gray-500">No templates yet.</li>}
                  </ul>
                </div>
                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold">Campaigns</div>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {campaigns.map((c) => (
                      <li key={c.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50">
                        <span>
                          {c.name}
                          <span className="ml-2 text-[11px] text-gray-400">{c.subject}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px]">{c.status}</span>
                          <button
                            onClick={async () => {
                              try {
                                await adminCall("send_campaign", { id: c.id });
                              } catch (e) {
                                setCampMsg(e instanceof Error ? e.message : "Not connected");
                              }
                            }}
                            className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[11px] text-white"
                          >
                            Send
                          </button>
                          <button onClick={async () => { await adminCall("delete_campaign", { id: c.id }); refreshCampaigns(); }} className="text-xs text-red-700 underline">Delete</button>
                        </span>
                      </li>
                    ))}
                    {campaigns.length === 0 && <li className="text-gray-500">No campaigns yet.</li>}
                  </ul>
                  <p className="mt-3 text-[11px] text-gray-400">
                    Sending goes live once an email provider is connected (Resend etc). Every email
                    automatically gets the legally required unsubscribe footer.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: Template; onClose: () => void }) {
  const [name, setName] = useState(template.name);
  const [blocks, setBlocks] = useState<Block[]>(template.blocks);
  const [saving, setSaving] = useState(false);

  const update = (i: number, b: Block) => setBlocks(blocks.map((x, j) => (j === i ? b : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <div className="grid gap-5 md:grid-cols-[420px_1fr]">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-gray-500">← Back</button>
          <button
            onClick={async () => {
              setSaving(true);
              await adminCall("save_template", { id: template.id || undefined, name, blocks });
              setSaving(false);
              onClose();
            }}
            disabled={saving}
            className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium" />
        <div className="mt-4 flex flex-col gap-3">
          {blocks.map((b, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-400">
                {b.type}
                <span className="flex gap-1">
                  <button onClick={() => move(i, -1)}>↑</button>
                  <button onClick={() => move(i, 1)}>↓</button>
                  <button onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} className="text-red-600">✕</button>
                </span>
              </div>
              {b.type === "heading" && (
                <input value={b.text} onChange={(e) => update(i, { ...b, text: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              )}
              {b.type === "text" && (
                <textarea value={b.text} rows={3} onChange={(e) => update(i, { ...b, text: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              )}
              {b.type === "image" && (
                <input value={b.url} placeholder="Image URL" onChange={(e) => update(i, { ...b, url: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
              )}
              {b.type === "button" && (
                <div className="mt-1 flex gap-2">
                  <input value={b.text} onChange={(e) => update(i, { ...b, text: e.target.value })} className="w-1/3 rounded border border-gray-300 px-2 py-1 text-sm" />
                  <input value={b.url} onChange={(e) => update(i, { ...b, url: e.target.value })} className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["logo", "heading", "text", "image", "button"] as const).map((t) => (
            <button
              key={t}
              onClick={() =>
                setBlocks([
                  ...blocks,
                  t === "logo" ? { type: "logo" }
                  : t === "heading" ? { type: "heading", text: "HEADING" }
                  : t === "text" ? { type: "text", text: "Write something…" }
                  : t === "image" ? { type: "image", url: "" }
                  : { type: "button", text: "SHOP NOW", url: "https://vdg-store.vercel.app/store" },
                ])
              }
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs capitalize"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto rounded-xl bg-gray-200 p-6 shadow-inner">
        <div className="text-center text-[11px] text-gray-500">Email preview</div>
        <div className="mt-3" dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }} />
      </div>
    </div>
  );
}
