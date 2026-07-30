"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminCall } from "../../adminApi";

/* Store editor: section forms left, live preview right. Saving publishes to
   site_settings; the storefront picks changes up on its next render
   (revalidate=60, so the preview iframe is reloaded with a cache-buster). */

type Accordion = { title: string; body: string };
type NavLabels = { globe: string; store: string; about: string; impact: string; work: string; policies: string };

const NAV_FIELDS: { key: keyof NavLabels; label: string }[] = [
  { key: "globe", label: "VDG Globe link" },
  { key: "store", label: "Store link" },
  { key: "about", label: "About Us link" },
  { key: "impact", label: "Our Impact link" },
  { key: "work", label: "Work For VDG link" },
  { key: "policies", label: "Policies link" },
];

const DEFAULT_ACCORDIONS: Accordion[] = [
  { title: "Impact Transparency Commitment", body: "" },
  { title: "Environmental Sustainability", body: "" },
  { title: "Size Chart", body: "" },
];

export default function StoreEditor() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [navLabels, setNavLabels] = useState<NavLabels | null>(null);
  const [accordions, setAccordions] = useState<Accordion[] | null>(null);
  const [banner, setBanner] = useState("");
  const [previewPath, setPreviewPath] = useState("/");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    adminCall<{ settings: Record<string, string> }>("get_settings").then((r) => {
      setSettings(r.settings);
      setBanner(r.settings.banner_text ?? "");
      try {
        const home = JSON.parse(r.settings.content_home ?? "{}");
        setNavLabels({
          globe: "VDG Globe™‎", store: "Store‎", about: "About Us‎",
          impact: "Our Impact", work: "Work For VDG‎", policies: "Policies‎",
          ...(home.navLabels ?? {}),
        });
      } catch { /* keep defaults */ }
      try {
        const prod = JSON.parse(r.settings.content_product ?? "{}");
        setAccordions(prod.accordions?.length ? prod.accordions : DEFAULT_ACCORDIONS);
      } catch {
        setAccordions(DEFAULT_ACCORDIONS);
      }
    });
  }, []);

  const reloadPreview = () => {
    if (iframe.current) {
      iframe.current.src = `${previewPath}?editor=${Date.now()}`;
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await adminCall("update_settings", {
        settings: {
          banner_text: banner,
          content_home: JSON.stringify({ navLabels }),
          content_product: JSON.stringify({ accordions }),
        },
      });
      sessionStorage.removeItem("vdg-banner");
      setMsg("Published. Live site updates within a minute.");
      reloadPreview();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="-mx-8 -mt-2 flex h-[calc(100vh-3.5rem-1rem)]">
      {/* Left: sections */}
      <div className="w-[380px] shrink-0 overflow-y-auto border-r border-black/10 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <Link href="/admin/online-store" className="text-sm text-gray-500 hover:text-black">
            ← Online Store
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Publishing…" : "Publish"}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-green-700">{msg}</p>}

        <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Banner</h2>
        <input
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />

        <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-gray-500">
          Home — menu labels
        </h2>
        {navLabels &&
          NAV_FIELDS.map((f) => (
            <label key={f.key} className="mt-2 block">
              <span className="text-[11px] text-gray-500">{f.label}</span>
              <input
                value={navLabels[f.key]}
                onChange={(e) => setNavLabels({ ...navLabels, [f.key]: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
          ))}

        <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-gray-500">
          Product page — info accordions
        </h2>
        {accordions?.map((a, i) => (
          <div key={i} className="mt-3 rounded-lg border border-gray-200 p-3">
            <input
              value={a.title}
              onChange={(e) =>
                setAccordions(accordions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
            />
            <textarea
              value={a.body}
              rows={4}
              placeholder="Body text"
              onChange={(e) =>
                setAccordions(accordions.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))
              }
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              onClick={() => setAccordions(accordions.filter((_, j) => j !== i))}
              className="mt-1 text-[11px] text-red-700 underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() => setAccordions([...(accordions ?? []), { title: "New section", body: "" }])}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
        >
          + Add accordion
        </button>

        <p className="mt-6 text-[11px] leading-relaxed text-gray-400">
          Products themselves (photos, prices, stock) are edited under Products. Themes, design
          history and the countdown lock live on the Online Store page.
        </p>
      </div>

      {/* Right: live preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-2">
          {["/", "/store", "/products/viva-a-visao-do-menino", "/about-us"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreviewPath(p);
                if (iframe.current) iframe.current.src = `${p}?editor=${Date.now()}`;
              }}
              className={`rounded px-2.5 py-1 text-xs ${previewPath === p ? "bg-[#1a1a1a] text-white" : "bg-gray-100"}`}
            >
              {p === "/" ? "Home" : p.split("/")[1] === "products" ? "Product" : p.slice(1)}
            </button>
          ))}
          <button onClick={reloadPreview} className="ml-auto rounded bg-gray-100 px-2.5 py-1 text-xs">
            ↻ Reload
          </button>
        </div>
        <iframe ref={iframe} src="/" className="min-h-0 flex-1 bg-white" title="Store preview" />
      </div>
    </div>
  );
}
