"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminCall } from "../../adminApi";
import { DEFAULT_ACCORDIONS } from "@/lib/defaultAccordions";
import { TABS as ABOUT_TABS, SECTIONS as ABOUT_DEFAULTS } from "@/app/about-us/content";

/* Store editor: section forms left, live preview right. Saving publishes to
   site_settings (and products directly); the storefront picks changes up on
   its next render (revalidate=60; the preview iframe reloads with a
   cache-buster). */

type Accordion = { title: string; body: string };
type NavLabels = { globe: string; store: string; about: string; impact: string; work: string; policies: string };
type AdminProduct = {
  id: number; title: string; handle: string; status: string; sort: number;
  description_html: string | null;
  product_images: { id: number; url: string; position: number }[];
  variants: { id: number; title: string; price_cents: number; stock: number }[];
};
type Buttons = {
  add_to_cart: string; sold_out: string; view_cart: string; checkout: string;
  uppercase: boolean; radius: string; style: "fill" | "outline";
};
type Fonts = { head: string; body: string };
type StoreCfg = { columns: 2 | 3 | 4; badge_bg: string; badge_fg: string; back_label: string; sold_out_label: string };
type HomeCfg = { hero_images: string[]; hero_mobile: string; hero_rotate: boolean; hero_interval_s: number };
type AboutSections = Record<string, { heading: string; body: string }[]>;

const NAV_FIELDS: { key: keyof NavLabels; label: string }[] = [
  { key: "globe", label: "VDG Globe link" },
  { key: "store", label: "Store link" },
  { key: "about", label: "About Us link" },
  { key: "impact", label: "Our Impact link" },
  { key: "work", label: "Work For VDG link" },
  { key: "policies", label: "Policies link" },
];
const FONT_CHOICES = [
  ["", "Theme default"],
  ["inconsolata", "Inconsolata (mono)"],
  ["platypi", "Platypi (serif)"],
  ["oswald", "Oswald (condensed)"],
  ["gochi", "Gochi Hand (marker)"],
  ["orbitron", "Orbitron (futuristic)"],
] as const;

const SECTIONS_LIST = [
  "Banner", "Home screen", "Products", "Store page", "Buttons", "Fonts", "Product page", "About page",
] as const;
type Section = (typeof SECTIONS_LIST)[number];

const input = "mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm";
const label = "mt-2 block text-[11px] text-gray-500";

export default function StoreEditor() {
  const [section, setSection] = useState<Section>("Banner");
  const [navLabels, setNavLabels] = useState<NavLabels | null>(null);
  const [accordions, setAccordions] = useState<Accordion[] | null>(null);
  const [banner, setBanner] = useState("");
  const [home, setHome] = useState<HomeCfg>({ hero_images: [], hero_mobile: "", hero_rotate: false, hero_interval_s: 8 });
  const [buttons, setButtons] = useState<Buttons>({
    add_to_cart: "Add To Cart", sold_out: "Sold Out", view_cart: "View Cart", checkout: "Checkout",
    uppercase: false, radius: "", style: "fill",
  });
  const [fonts, setFonts] = useState<Fonts>({ head: "", body: "" });
  const [store, setStore] = useState<StoreCfg>({ columns: 4, badge_bg: "", badge_fg: "", back_label: "Back Home", sold_out_label: "Sold Out" });
  const [about, setAbout] = useState<AboutSections>(() => JSON.parse(JSON.stringify(ABOUT_DEFAULTS)));
  const [aboutTab, setAboutTab] = useState<string>(ABOUT_TABS[0]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [openProduct, setOpenProduct] = useState<number | null>(null);
  const [previewPath, setPreviewPath] = useState("/");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  const loadProducts = () =>
    adminCall<{ products: AdminProduct[] }>("list_products").then((r) => setProducts(r.products));

  useEffect(() => {
    loadProducts();
    adminCall<{ settings: Record<string, string> }>("get_settings").then((r) => {
      setBanner(r.settings.banner_text ?? "");
      const json = <T,>(key: string, fb: T): T => {
        try { return { ...fb, ...JSON.parse(r.settings[key] ?? "{}") }; } catch { return fb; }
      };
      const homeCfg = json<HomeCfg & { navLabels?: Partial<NavLabels> }>("content_home", {
        hero_images: [], hero_mobile: "", hero_rotate: false, hero_interval_s: 8,
      });
      setHome({
        hero_images: homeCfg.hero_images ?? [],
        hero_mobile: homeCfg.hero_mobile ?? "",
        hero_rotate: !!homeCfg.hero_rotate,
        hero_interval_s: homeCfg.hero_interval_s || 8,
      });
      setNavLabels({
        globe: "VDG Globe™‎", store: "Store‎", about: "About Us‎",
        impact: "Our Impact", work: "Work For VDG‎", policies: "Policies‎",
        ...(homeCfg.navLabels ?? {}),
      });
      setButtons(json("content_buttons", buttons));
      setFonts(json("content_fonts", fonts));
      setStore(json("content_store", store));
      const ab = json<{ sections?: AboutSections }>("content_about", {});
      if (ab.sections) setAbout((prev) => ({ ...prev, ...ab.sections }));
      try {
        const prod = JSON.parse(r.settings.content_product ?? "{}");
        setAccordions(prod.accordions?.length ? prod.accordions : DEFAULT_ACCORDIONS);
      } catch { setAccordions(DEFAULT_ACCORDIONS); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadPreview = () => {
    if (iframe.current) iframe.current.src = `${previewPath}?editor=${Date.now()}`;
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await adminCall("update_settings", {
        settings: {
          banner_text: banner,
          content_home: JSON.stringify({ navLabels, ...home }),
          content_product: JSON.stringify({ accordions }),
          content_buttons: JSON.stringify(buttons),
          content_fonts: JSON.stringify(fonts),
          content_store: JSON.stringify(store),
          content_about: JSON.stringify({ sections: about }),
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

  const moveProduct = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= products.length) return;
    const next = [...products];
    [next[i], next[j]] = [next[j], next[i]];
    setProducts(next);
    await Promise.all(
      next.map((p, idx) => adminCall("update_product", { id: p.id, fields: { sort: (idx + 1) * 10 } }))
    );
    setMsg("Order saved — live within a minute.");
  };

  const patchProduct = async (id: number, fields: Record<string, unknown>) => {
    await adminCall("update_product", { id, fields });
    setMsg("Saved.");
  };

  const uploadHero = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const r = await adminCall<{ url: string }>("upload_asset", { filename: file.name, base64: btoa(bin) });
    setHome((h) => ({ ...h, hero_images: [...h.hero_images, r.url] }));
  };

  return (
    <div className="-mx-8 -mt-2 flex h-[calc(100vh-3.5rem-1rem)]">
      {/* Left: sections */}
      <div className="w-[420px] shrink-0 overflow-y-auto border-r border-black/10 bg-white px-5 py-4">
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

        <div className="mt-4 flex flex-wrap gap-1.5">
          {SECTIONS_LIST.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${section === s ? "bg-[#1a1a1a] text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {section === "Banner" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Top banner text</h2>
            <input value={banner} onChange={(e) => setBanner(e.target.value)} className={input} />
          </div>
        )}

        {section === "Home screen" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Background images</h2>
            <p className="mt-1 text-[11px] text-gray-400">
              First image is the default. Add more + turn on rotation for refreshing backgrounds.
            </p>
            {home.hero_images.map((url, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-10 w-14 rounded object-cover" />
                ) : (
                  <div className="h-10 w-14 shrink-0 rounded bg-gray-100" />
                )}
                <input
                  value={url}
                  onChange={(e) =>
                    setHome({ ...home, hero_images: home.hero_images.map((u, j) => (j === i ? e.target.value : u)) })
                  }
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                />
                <button
                  onClick={() => setHome({ ...home, hero_images: home.hero_images.filter((_, j) => j !== i) })}
                  className="text-xs text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
            {home.hero_images.length === 0 && (
              <p className="mt-2 text-[11px] text-gray-400">Using the built-in background.</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setHome({ ...home, hero_images: [...home.hero_images, ""] })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
              >
                + Add image URL
              </button>
              <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs">
                Upload…
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadHero(e.target.files[0])}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={home.hero_rotate}
                onChange={(e) => setHome({ ...home, hero_rotate: e.target.checked })}
              />
              Rotate backgrounds
            </label>
            {home.hero_rotate && (
              <label className={label}>
                Seconds per image
                <input
                  type="number"
                  min={3}
                  value={home.hero_interval_s}
                  onChange={(e) => setHome({ ...home, hero_interval_s: Number(e.target.value) || 8 })}
                  className={input}
                />
              </label>
            )}
            <label className={label}>
              Mobile background URL (blank = built-in)
              <input
                value={home.hero_mobile}
                onChange={(e) => setHome({ ...home, hero_mobile: e.target.value })}
                className={input}
              />
            </label>

            <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Menu labels</h2>
            {navLabels &&
              NAV_FIELDS.map((f) => (
                <label key={f.key} className={label}>
                  {f.label}
                  <input
                    value={navLabels[f.key]}
                    onChange={(e) => setNavLabels({ ...navLabels, [f.key]: e.target.value })}
                    className={input}
                  />
                </label>
              ))}
          </div>
        )}

        {section === "Products" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
              Order & quick edit
            </h2>
            <p className="mt-1 text-[11px] text-gray-400">
              ↑↓ changes the order on the store page (saves immediately). Click a product to edit it.
            </p>
            {products.map((p, i) => (
              <div key={p.id} className="mt-2 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 p-2">
                  <div className="flex flex-col">
                    <button onClick={() => moveProduct(i, -1)} disabled={i === 0} className="text-xs disabled:opacity-25">▲</button>
                    <button onClick={() => moveProduct(i, 1)} disabled={i === products.length - 1} className="text-xs disabled:opacity-25">▼</button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.product_images[0] && <img src={p.product_images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}
                  <button onClick={() => setOpenProduct(openProduct === p.id ? null : p.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                    {p.title}
                  </button>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.status === "active" ? "bg-[#cdfee1]" : "bg-gray-200"}`}>
                    {p.status}
                  </span>
                </div>
                {openProduct === p.id && (
                  <div className="border-t border-gray-100 p-3">
                    <label className={label}>
                      Title
                      <input
                        defaultValue={p.title}
                        onBlur={(e) => e.target.value !== p.title && patchProduct(p.id, { title: e.target.value }).then(loadProducts)}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Price (all sizes) — dollars
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={((p.variants[0]?.price_cents ?? 0) / 100).toFixed(2)}
                        onBlur={(e) => {
                          const cents = Math.round(Number(e.target.value) * 100);
                          if (cents && cents !== p.variants[0]?.price_cents)
                            adminCall("set_product_price", { productId: p.id, price_cents: cents })
                              .then(() => { setMsg("Price updated."); loadProducts(); })
                              .catch((err) => setMsg(err.message));
                        }}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      Description (HTML allowed)
                      <textarea
                        rows={4}
                        defaultValue={p.description_html ?? ""}
                        onBlur={(e) => e.target.value !== (p.description_html ?? "") && patchProduct(p.id, { description_html: e.target.value })}
                        className={input}
                      />
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.status === "active"}
                        onChange={(e) => patchProduct(p.id, { status: e.target.checked ? "active" : "draft" }).then(loadProducts)}
                      />
                      Visible on store
                    </label>
                    <p className="mt-2 text-[11px] text-gray-400">
                      Photos, sizes & stock:{" "}
                      <Link href="/admin/products" className="underline">full editor →</Link>{" "}
                      (first photo = store image, second = hover image)
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {section === "Store page" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Store grid</h2>
            <label className={label}>
              Columns (desktop)
              <select
                value={store.columns}
                onChange={(e) => setStore({ ...store, columns: Number(e.target.value) as 2 | 3 | 4 })}
                className={input}
              >
                {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className={label}>
              Back link text
              <input value={store.back_label} onChange={(e) => setStore({ ...store, back_label: e.target.value })} className={input} />
            </label>
            <label className={label}>
              Sold-out badge text
              <input value={store.sold_out_label} onChange={(e) => setStore({ ...store, sold_out_label: e.target.value })} className={input} />
            </label>
            <div className="mt-2 flex items-end gap-4">
              <label className="text-[11px] text-gray-500">
                Badge colour
                <input
                  type="color"
                  value={store.badge_bg || "#a51b1b"}
                  onChange={(e) => setStore({ ...store, badge_bg: e.target.value })}
                  className="mt-0.5 block h-8 w-14 cursor-pointer"
                />
              </label>
              <label className="text-[11px] text-gray-500">
                Badge text colour
                <input
                  type="color"
                  value={store.badge_fg || "#ffffff"}
                  onChange={(e) => setStore({ ...store, badge_fg: e.target.value })}
                  className="mt-0.5 block h-8 w-14 cursor-pointer"
                />
              </label>
              <button
                onClick={() => setStore({ ...store, badge_bg: "", badge_fg: "" })}
                className="pb-1 text-[11px] underline"
              >
                Use theme colour
              </button>
            </div>
          </div>
        )}

        {section === "Buttons" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Button text</h2>
            {(
              [
                ["add_to_cart", "Add to cart"],
                ["sold_out", "Sold out"],
                ["view_cart", "View cart"],
                ["checkout", "Checkout"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className={label}>
                {l}
                <input value={buttons[k]} onChange={(e) => setButtons({ ...buttons, [k]: e.target.value })} className={input} />
              </label>
            ))}
            <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Button style</h2>
            <label className={label}>
              Style
              <select
                value={buttons.style}
                onChange={(e) => setButtons({ ...buttons, style: e.target.value as "fill" | "outline" })}
                className={input}
              >
                <option value="fill">Filled</option>
                <option value="outline">Outlined</option>
              </select>
            </label>
            <label className={label}>
              Corner radius
              <select
                value={buttons.radius}
                onChange={(e) => setButtons({ ...buttons, radius: e.target.value })}
                className={input}
              >
                <option value="">Theme default</option>
                <option value="0px">Square</option>
                <option value="6px">Slightly rounded</option>
                <option value="12px">Rounded</option>
                <option value="999px">Pill</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={buttons.uppercase}
                onChange={(e) => setButtons({ ...buttons, uppercase: e.target.checked })}
              />
              UPPERCASE button text
            </label>
          </div>
        )}

        {section === "Fonts" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Site fonts</h2>
            <p className="mt-1 text-[11px] text-gray-400">Overrides the theme's fonts across the whole storefront.</p>
            {(
              [
                ["head", "Headings & titles"],
                ["body", "Body text & prices"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className={label}>
                {l}
                <select
                  value={fonts[k]}
                  onChange={(e) => setFonts({ ...fonts, [k]: e.target.value })}
                  className={input}
                >
                  {FONT_CHOICES.map(([v, name]) => (
                    <option key={v} value={v}>{name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {section === "Product page" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Info accordions</h2>
            {accordions?.map((a, i) => (
              <div key={i} className="mt-3 rounded-lg border border-gray-200 p-3">
                <input
                  value={a.title}
                  onChange={(e) => setAccordions(accordions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                />
                <textarea
                  value={a.body}
                  rows={4}
                  placeholder="Body text"
                  onChange={(e) => setAccordions(accordions.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
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
          </div>
        )}

        {section === "About page" && (
          <div className="mt-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Manifesto text</h2>
            <div className="mt-2 flex gap-1.5">
              {ABOUT_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setAboutTab(t)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${aboutTab === t ? "bg-[#1a1a1a] text-white" : "bg-gray-100"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {(about[aboutTab] ?? []).map((s, i) => (
              <div key={i} className="mt-3 rounded-lg border border-gray-200 p-3">
                <input
                  value={s.heading}
                  onChange={(e) =>
                    setAbout({ ...about, [aboutTab]: about[aboutTab].map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                />
                <textarea
                  value={s.body}
                  rows={4}
                  onChange={(e) =>
                    setAbout({ ...about, [aboutTab]: about[aboutTab].map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })
                  }
                  className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <button
                  onClick={() => setAbout({ ...about, [aboutTab]: about[aboutTab].filter((_, j) => j !== i) })}
                  className="mt-1 text-[11px] text-red-700 underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setAbout({ ...about, [aboutTab]: [...(about[aboutTab] ?? []), { heading: "New heading", body: "" }] })
              }
              className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
            >
              + Add block
            </button>
          </div>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-gray-400">
          Sizes, stock and photos live under Products. Themes, design history and the countdown lock
          are on the Online Store page.
        </p>
      </div>

      {/* Right: live preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-2">
          {["/", "/store", "/products/viva-a-visao-do-menino", "/about-us", "/cart"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreviewPath(p);
                if (iframe.current) iframe.current.src = `${p}?editor=${Date.now()}`;
              }}
              className={`rounded px-2.5 py-1 text-xs ${previewPath === p ? "bg-[#1a1a1a] text-white" : "bg-gray-100"}`}
            >
              {p === "/" ? "Home" : p === "/store" ? "Store" : p === "/about-us" ? "About" : p === "/cart" ? "Cart" : "Product"}
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
