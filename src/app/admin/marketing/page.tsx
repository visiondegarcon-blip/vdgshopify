"use client";
import { useEffect, useRef, useState } from "react";
import { adminCall } from "../adminApi";
import DragImage from "../DragImage";
import { EMAIL_FONTS, blocksToHtml, type Block, type EmailFont } from "@/lib/emailHtml";
import { countryName } from "@/lib/countries";

/* Marketing: scroll-popup builder, audience (subscribers), campaigns with a
   block-based email template maker. Campaigns send through Resend using our
   own subscriber list and per-recipient unsubscribe tokens. */

type PopupCfg = {
  enabled: boolean; delay_seconds: number; heading: string; body: string; image: string;
  image_pos: string; bg: string; fg: string; accent: string; discount_code: string; collect_phone: boolean; collect_country: boolean;
  font_head: string; font_body: string;
};
const POPUP_DEFAULTS: PopupCfg = {
  enabled: false, delay_seconds: 8, heading: "JOIN THE VISION",
  body: "Sign up and get a discount code for your first order.",
  image: "", image_pos: "50% 50%", bg: "#000000", fg: "#ffffff", accent: "#FE0000", discount_code: "", collect_phone: false, collect_country: false,
  font_head: "", font_body: "",
};
const SITE_FONTS = [
  ["", "Site default"],
  ["inconsolata", "Inconsolata (mono)"],
  ["platypi", "Platypi (serif)"],
  ["oswald", "Oswald (condensed)"],
  ["gochi", "Gochi Hand (marker)"],
  ["orbitron", "Orbitron (futuristic)"],
] as const;
const fontVar = (k: string) => (k ? `var(--font-${k})` : undefined);

type Subscriber = {
  id: number; email: string; phone: string | null; country: string | null; source: string;
  consented_at: string; unsubscribed_at: string | null;
};

type Template = { id: number; name: string; blocks: Block[]; font?: EmailFont };
type Campaign = {
  id: number; name: string; subject: string; status: string; template_id: number | null;
  sent_at: string | null; email_templates: { name: string } | null;
};


export default function MarketingPage() {
  const [tab, setTab] = useState<"popup" | "audience" | "campaigns">("popup");

  // popup
  const [popup, setPopup] = useState<PopupCfg>(POPUP_DEFAULTS);
  const [popupMsg, setPopupMsg] = useState<string | null>(null);
  const popupRef = useRef<PopupCfg>(POPUP_DEFAULTS);
  const setPopupBoth = (next: PopupCfg) => { popupRef.current = next; setPopup(next); };

  // audience
  const [subs, setSubs] = useState<Subscriber[] | null>(null);

  // campaigns
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [campMsg, setCampMsg] = useState<string | null>(null);
  const [emailFrom, setEmailFrom] = useState("");
  const [sending, setSending] = useState<number | null>(null);

  useEffect(() => {
    adminCall<{ settings: Record<string, string> }>("get_settings").then((r) => {
      try {
        setPopupBoth({ ...POPUP_DEFAULTS, ...JSON.parse(r.settings.popup_config ?? "{}") });
      } catch {}
      setEmailFrom(r.settings.email_from ?? "");
    });
  }, []);

  const sendTest = async (campaignId: number) => {
    const to = prompt("Send a test copy to which email address?");
    if (!to) return;
    setCampMsg(null);
    try {
      await adminCall("send_test_email", { campaignId, to });
      setCampMsg(`Test sent to ${to}. Check that inbox (and spam).`);
    } catch (e) {
      setCampMsg(e instanceof Error ? e.message : "Test send failed");
    }
  };

  const sendCampaign = async (c: Campaign) => {
    const live = subs?.filter((s) => !s.unsubscribed_at).length;
    const who = live != null ? `${live} subscriber${live === 1 ? "" : "s"}` : "all current subscribers";
    if (!confirm(`Send "${c.name}" to ${who}? This cannot be undone.`)) return;
    setSending(c.id);
    setCampMsg(null);
    try {
      const r = await adminCall<{ sent: number; failed: number; errors: string[] }>("send_campaign", { id: c.id });
      setCampMsg(
        r.failed
          ? `Sent to ${r.sent}, ${r.failed} failed — ${r.errors[0] ?? ""}`
          : `Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}.`
      );
      refreshCampaigns();
    } catch (e) {
      setCampMsg(e instanceof Error ? e.message : "Send failed");
    }
    setSending(null);
  };

  useEffect(() => {
    if (tab === "audience") adminCall<{ subscribers: Subscriber[] }>("list_subscribers").then((r) => setSubs(r.subscribers));
    if (tab === "campaigns") refreshCampaigns();
  }, [tab]);

  const refreshCampaigns = () => {
    return Promise.all([
      adminCall<{ templates: Template[] }>("list_templates").then((r) => setTemplates(r.templates)),
      adminCall<{ campaigns: Campaign[] }>("list_campaigns").then((r) => setCampaigns(r.campaigns)),
    ]);
  };

  const savePopup = async (patch: Partial<PopupCfg> = {}) => {
    const next = { ...popupRef.current, ...patch };
    setPopupBoth(next);
    await adminCall("update_settings", { settings: { popup_config: JSON.stringify(next) } });
    setPopupMsg("Saved — live on the store immediately.");
  };

  const exportSubs = () => {
    if (!subs) return;
    const lines = ["email,phone,country,source,consented_at,unsubscribed"];
    for (const s of subs)
      lines.push(`${s.email},${s.phone ?? ""},${s.country ?? ""},${s.source},${s.consented_at},${s.unsubscribed_at ? "yes" : "no"}`);
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
                <input type="checkbox" checked={popup.enabled} onChange={(e) => savePopup({ enabled: e.target.checked })} />
                {popup.enabled ? "Live" : "Off"}
              </label>
            </div>
            {popupMsg && <p className="mt-1 text-xs text-green-700">{popupMsg}</p>}
            <div className="mt-4 grid gap-3">
              <label className="text-[12px]">
                Shows after {popup.delay_seconds}s spent on the site
                <input type="range" min={1} max={60} step={1} value={popup.delay_seconds}
                  onChange={(e) => setPopupBoth({ ...popup, delay_seconds: Number(e.target.value) })}
                  onMouseUp={() => savePopup()} onTouchEnd={() => savePopup()}
                  className="mt-1 w-full" />
                <span className="text-[11px] text-gray-400">
                  Counts time the tab is actually in front, not wall-clock time.
                </span>
              </label>
              <label className="text-[12px]">Heading
                <input value={popup.heading} onChange={(e) => setPopupBoth({ ...popup, heading: e.target.value })} onBlur={() => savePopup()}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              <label className="text-[12px]">Body
                <textarea value={popup.body} rows={2} onChange={(e) => setPopupBoth({ ...popup, body: e.target.value })} onBlur={() => savePopup()}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              <label className="text-[12px]">Image URL (left side of popup, optional)
                <input value={popup.image} onChange={(e) => setPopupBoth({ ...popup, image: e.target.value })} onBlur={() => savePopup()}
                  placeholder="/products/... or https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </label>
              {popup.image && (
                <DragImage
                  src={popup.image}
                  pos={popup.image_pos}
                  aspect="3/4"
                  onChange={(p) => savePopup({ image_pos: p })}
                />
              )}
              <label className="text-[12px]">Discount code revealed after signup (create it under Discounts first)
                <input value={popup.discount_code} onChange={(e) => setPopupBoth({ ...popup, discount_code: e.target.value.toUpperCase() })} onBlur={() => savePopup()}
                  placeholder="VISION10"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm" />
              </label>
              <div className="flex items-end gap-4">
                {(["bg", "fg", "accent"] as const).map((k) => (
                  <label key={k} className="text-[12px]">
                    {k === "bg" ? "Background" : k === "fg" ? "Text" : "Accent"}
                    <input type="color" value={popup[k]} onChange={(e) => setPopupBoth({ ...popup, [k]: e.target.value })} onBlur={() => savePopup()}
                      className="mt-1 block h-8 w-14 cursor-pointer" />
                  </label>
                ))}
                <label className="flex items-center gap-1.5 pb-1 text-[12px]">
                  <input type="checkbox" checked={popup.collect_phone} onChange={(e) => savePopup({ collect_phone: e.target.checked })} />
                  Phone field
                </label>
                <label className="flex items-center gap-1.5 pb-1 text-[12px]">
                  <input type="checkbox" checked={popup.collect_country} onChange={(e) => savePopup({ collect_country: e.target.checked })} />
                  Country field
                </label>
              </div>
              <div className="flex gap-3">
                {(
                  [
                    ["font_head", "Heading font"],
                    ["font_body", "Body font"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="flex-1 text-[12px]">
                    {l}
                    <select
                      value={popup[k]}
                      onChange={(e) => savePopup({ [k]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {SITE_FONTS.map(([v, name]) => (
                        <option key={v} value={v}>{name}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* live preview */}
          <div className="rounded-xl bg-gray-200 p-6 shadow-inner">
            <div className="text-center text-[11px] text-gray-500">Preview</div>
            <div className="mt-3 grid overflow-hidden shadow-2xl sm:grid-cols-2" style={{ background: popup.bg, color: popup.fg, borderRadius: 8 }}>
              {popup.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={popup.image} alt="" className="hidden h-full min-h-[260px] w-full object-cover sm:block" style={{ objectPosition: popup.image_pos || "50% 50%" }} />
              )}
              <div className="flex flex-col justify-center p-5 text-center">
                <div className="text-[15px] font-bold leading-snug" style={{ fontFamily: fontVar(popup.font_head) ?? "var(--vdg-font-body, serif)" }}>{popup.heading}</div>
                <p className="mt-2 text-[11px] italic opacity-85">{popup.body}</p>
                <div className="mt-3 rounded bg-white px-3 py-1.5 text-left">
                  <div className="text-[9px] text-gray-500">Email</div>
                  <div className="text-[11px] text-gray-300">&nbsp;</div>
                </div>
                {popup.collect_phone && (
                  <div className="mt-2 flex gap-2">
                    <div className="flex w-10 items-center justify-center rounded bg-white text-base">🇦🇺</div>
                    <div className="w-full rounded bg-white px-3 py-1.5 text-left">
                      <div className="text-[9px] text-gray-500">Phone</div>
                      <div className="text-[11px] text-black">+61</div>
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded px-4 py-2 text-xs font-semibold" style={{ background: popup.accent, color: popup.bg }}>Join</div>
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
                <tr><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Phone</th><th className="px-4 py-2.5">Country</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Signed up</th><th className="px-4 py-2.5">Status</th><th></th></tr>
              </thead>
              <tbody>
                {subs?.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2">{s.phone ?? "—"}</td>
                    <td className="px-4 py-2">{s.country ? countryName(s.country) : "—"}</td>
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No contacts yet — the popup and countdown lock feed this list.</td></tr>
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
              onClose={async () => { await refreshCampaigns(); setEditing(null); }}
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

              <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
                <label className="text-[12px] font-semibold">
                  Sender address
                  <input
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    onBlur={async () => {
                      await adminCall("update_settings", { settings: { email_from: emailFrom } });
                      setCampMsg("Sender address saved.");
                    }}
                    placeholder="Vision De Garçon <news@news.visiondegarcon.fr>"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm font-normal"
                  />
                </label>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                  Must be an address on a domain you&apos;ve verified in Resend. Leave blank to use
                  Resend&apos;s test sender, which can only deliver to your own Resend account email —
                  fine for testing, but real campaigns need the verified domain.
                </p>
              </div>

              <Automations />

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
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px]">
                            {c.status}
                            {c.sent_at ? ` · ${new Date(c.sent_at).toLocaleDateString()}` : ""}
                          </span>
                          <button onClick={() => sendTest(c.id)} className="rounded border border-gray-300 px-2 py-0.5 text-[11px]">
                            Test
                          </button>
                          <button
                            onClick={() => sendCampaign(c)}
                            disabled={sending === c.id}
                            className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[11px] text-white disabled:opacity-50"
                          >
                            {sending === c.id ? "Sending…" : c.status === "sent" ? "Resend" : "Send"}
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
  const [font, setFont] = useState<EmailFont>(template.font ?? "mono");
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
              await adminCall("save_template", { id: template.id || undefined, name, blocks, font });
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
        <label className="mt-2 block text-[11px] text-gray-500">
          Font (email-safe only — mail apps can&apos;t load custom fonts)
          <select
            value={font}
            onChange={(e) => setFont(e.target.value as EmailFont)}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {(Object.keys(EMAIL_FONTS) as EmailFont[]).map((k) => (
              <option key={k} value={k}>{EMAIL_FONTS[k].label}</option>
            ))}
          </select>
        </label>
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
        <div className="mt-3" dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks, font) }} />
      </div>
    </div>
  );
}

/* Abandoned-cart + low-stock sweeps. Vercel's Hobby plan only allows one
   scheduled run per day, so the button matters: it's how you send today's
   nudges without waiting for tonight's cron. */
function Automations() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  type Sweep = { sent: number; skipped: number; errors: string[] };
  const run = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await adminCall<{ abandoned: Sweep; lowStock: Sweep }>("run_automations");
      const parts = [
        `${r.abandoned.sent} cart ${r.abandoned.sent === 1 ? "email" : "emails"}`,
        r.lowStock.sent ? "a stock digest" : "no stock digest needed",
      ];
      setMsg(`Sent ${parts.join(" and ")}.`);
      const problems = [...r.abandoned.errors, ...r.lowStock.errors];
      if (problems.length) setErr(problems.join(" · "));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">Automated emails</div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Runs nightly: recovery emails for carts abandoned 4–48 hours ago, plus a low-stock
            digest. Back-in-stock alerts don&apos;t wait for this — they go out the moment you
            raise a sold-out size. Thresholds live in Settings.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {busy ? "Running…" : "Run now"}
        </button>
      </div>
      {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">{msg}</p>}
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{err}</p>}
    </div>
  );
}
