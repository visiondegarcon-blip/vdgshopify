"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { sessionId, track } from "@/lib/track";

type PopupConfig = {
  enabled: boolean;
  scroll_percent: number;
  heading: string;
  body: string;
  image: string;
  bg: string;
  fg: string;
  accent: string;
  discount_code: string;
  collect_phone: boolean;
};

const COUNTRIES: { code: string; dial: string; flag: string; name: string }[] = [
  { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "NZ", dial: "+64", flag: "🇳🇿", name: "New Zealand" },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "BE", dial: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "CH", dial: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "IE", dial: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "SE", dial: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "NO", dial: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "DK", dial: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "KR", dial: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "ID", dial: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "RW", dial: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "CD", dial: "+243", flag: "🇨🇩", name: "DR Congo" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
];

/* Scroll-triggered signup popup, configured from the admin Marketing tab.
   Shopify-style layout: image panel left, form right, flag dial-code picker.
   Shows once, then stays hidden for 30 days (or forever after signup). */
export default function ScrollPopup() {
  const pathname = usePathname();
  const [cfg, setCfg] = useState<PopupConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("AU");
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const excluded =
    pathname.startsWith("/admin") || pathname.startsWith("/cart") || pathname.startsWith("/success");

  useEffect(() => {
    if (excluded) return;
    const snooze = localStorage.getItem("vdg-popup-until");
    if (snooze && Number(snooze) > Date.now()) return;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "popup_config")
      .maybeSingle()
      .then(({ data }) => {
        try {
          const parsed = JSON.parse(data?.value ?? "{}") as PopupConfig;
          if (parsed.enabled) setCfg(parsed);
        } catch {}
      });
  }, [excluded]);

  useEffect(() => {
    if (!cfg || open) return;
    const target = Math.min(95, Math.max(5, cfg.scroll_percent || 30));
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - innerHeight;
      const pct = scrollable > 0 ? (scrollY / scrollable) * 100 : 100;
      if (pct >= target) {
        setOpen(true);
        removeEventListener("scroll", onScroll);
      }
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => removeEventListener("scroll", onScroll);
  }, [cfg, open]);

  if (!cfg || !open || excluded) return null;

  const dismiss = () => {
    localStorage.setItem("vdg-popup-until", String(Date.now() + 30 * 864e5));
    setOpen(false);
  };

  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+61";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const fullPhone = phone.trim() ? `${dial} ${phone.trim().replace(/^0+/, "")}` : "";
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone: fullPhone, source: "popup", sid: sessionId() }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error ?? "Try again.");
    localStorage.setItem("vdg-popup-until", String(Date.now() + 3650 * 864e5));
    setCode(j.discount_code);
    track("popup_signup");
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${cfg.fg}44`,
    color: cfg.fg,
    borderRadius: 8,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={dismiss}>
      <div
        className="relative grid w-full max-w-2xl overflow-hidden shadow-2xl sm:grid-cols-2"
        style={{ background: cfg.bg, color: cfg.fg, borderRadius: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        {cfg.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.image} alt="" className="hidden h-full min-h-[380px] w-full object-cover sm:block" />
        ) : (
          <div className="hidden min-h-[380px] sm:block" style={{ background: `${cfg.accent}22` }} />
        )}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-2 z-10 text-2xl leading-none opacity-60 hover:opacity-100"
          style={{ color: cfg.fg }}
        >
          ×
        </button>
        <div className="flex flex-col justify-center p-7 sm:p-8">
          {cfg.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.image} alt="" className="mb-4 h-28 w-full rounded-lg object-cover sm:hidden" />
          )}
          <h2 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--vdg-font-head)" }}>
            {cfg.heading}
          </h2>
          <p className="mt-2 text-sm italic opacity-75">{cfg.body}</p>
          {code == null ? (
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
              {cfg.collect_phone && (
                <>
                  <div className="flex items-center justify-center gap-3 text-[11px] uppercase tracking-widest opacity-50">
                    <span className="h-px flex-1" style={{ background: `${cfg.fg}33` }} />
                    or
                    <span className="h-px flex-1" style={{ background: `${cfg.fg}33` }} />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex shrink-0 items-center" style={inputStyle}>
                      <span className="pointer-events-none flex items-center gap-1.5 px-2.5 text-sm">
                        <span className="text-base">{COUNTRIES.find((c) => c.code === country)?.flag}</span>
                        <span className="opacity-75">{dial}</span>
                        <span className="text-[9px] opacity-50">▼</span>
                      </span>
                      <select
                        aria-label="Country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name} ({c.dial})
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
              {err && <p className="text-xs" style={{ color: cfg.accent }}>{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1.5 w-full rounded-lg px-4 py-3 text-sm font-bold tracking-wide disabled:opacity-60"
                style={{ background: cfg.accent, color: cfg.bg }}
              >
                {busy ? "…" : "Join"}
              </button>
              <p className="text-center text-[10px] opacity-50">No spam — unsubscribe anytime.</p>
            </form>
          ) : (
            <div className="mt-5">
              <p className="text-sm">You&apos;re in.{code ? " Your code:" : ""}</p>
              {code && (
                <div
                  className="mt-2 inline-block border border-dashed px-4 py-2 font-mono text-lg font-bold tracking-widest"
                  style={{ borderColor: cfg.accent, color: cfg.accent }}
                >
                  {code}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
