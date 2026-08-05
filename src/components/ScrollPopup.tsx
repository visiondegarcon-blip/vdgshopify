"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { sessionId, track } from "@/lib/track";

type PopupConfig = {
  enabled: boolean;
  delay_seconds: number;
  heading: string;
  body: string;
  image: string;
  bg: string;
  fg: string;
  accent: string;
  discount_code: string;
  collect_phone: boolean;
  collect_country?: boolean;
  image_pos?: string;
  font_head?: string;
  font_body?: string;
};

const popupFont = (k?: string) => (k ? `var(--font-${k})` : undefined);

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

/* Time-triggered signup popup, configured from the admin Marketing tab.
   Shopify-style layout: image panel left, form right, flag dial-code picker.
   Opens after `delay_seconds` of time actually spent on the site (not
   elapsed wall-clock) so a visitor who tabs away and back doesn't get it
   fired the moment they return. Shows once, then stays hidden for 30 days
   (or forever after signup). */
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
    const target = Math.min(120, Math.max(1, cfg.delay_seconds ?? 8));
    let spent = 0;
    const tick = () => {
      // only count time the tab is actually in front — a backgrounded tab
      // shouldn't rack up "time on site" while nobody's looking at it
      if (!document.hidden) spent += 1;
      if (spent >= target) {
        setOpen(true);
        clearInterval(id);
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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
      /* Only claim to know their country when they actually told us: either
         the country field was shown, or they typed a phone number against a
         dial code they chose. Otherwise it's just the AU default and would
         quietly poison the audience data. */
      body: JSON.stringify({
        email,
        phone: fullPhone,
        country: cfg.collect_country || fullPhone ? country : null,
        source: "popup",
        sid: sessionId(),
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error ?? "Try again.");
    localStorage.setItem("vdg-popup-until", String(Date.now() + 3650 * 864e5));
    setCode(j.discount_code);
    track("popup_signup");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={dismiss}>
      <div
        className="relative grid w-full max-w-[640px] overflow-hidden shadow-2xl sm:grid-cols-2"
        style={{ background: cfg.bg, color: cfg.fg, borderRadius: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        {cfg.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfg.image}
            alt=""
            className="hidden h-full min-h-[420px] w-full object-cover sm:block"
            style={{ objectPosition: cfg.image_pos || "50% 50%" }}
          />
        ) : (
          <div className="hidden min-h-[420px] sm:block" style={{ background: `${cfg.accent}22` }} />
        )}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-3 z-10 text-2xl font-light leading-none opacity-80 hover:opacity-100"
          style={{ color: cfg.fg }}
        >
          ✕
        </button>
        <div className="flex flex-col justify-center px-6 py-7 text-center sm:px-7" style={{ fontFamily: popupFont(cfg.font_body) }}>
          {cfg.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.image}
              alt=""
              className="mb-4 h-28 w-full rounded-lg object-cover sm:hidden"
              style={{ objectPosition: cfg.image_pos || "50% 50%" }}
            />
          )}
          <h2 className="text-[20px] font-bold leading-snug" style={{ fontFamily: popupFont(cfg.font_head) ?? "var(--vdg-font-head)" }}>
            {cfg.heading}
          </h2>
          <p className="mt-2 text-[13px] italic opacity-85">{cfg.body}</p>
          {code == null ? (
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
              <div className="rounded-lg bg-white px-3.5 py-1.5 text-left">
                <div className="text-[10px] text-gray-500">Email</div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-black outline-none"
                />
              </div>
              {cfg.collect_country && (
                <div className="w-full rounded-lg bg-white px-3.5 py-1.5 text-left">
                  <div className="text-[10px] text-gray-500">Country</div>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full cursor-pointer bg-transparent text-[13px] text-black outline-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {cfg.collect_phone && (
                <>
                  <div className="flex items-center gap-4 opacity-90">
                    <span className="h-px flex-1" style={{ background: cfg.fg }} />
                    <span className="text-sm">or</span>
                    <span className="h-px flex-1" style={{ background: cfg.fg }} />
                  </div>
                  <div className="flex gap-2.5">
                    <div className="relative flex w-[86px] shrink-0 items-center justify-center rounded-lg bg-white">
                      <span className="pointer-events-none text-[24px] leading-none">
                        {COUNTRIES.find((c) => c.code === country)?.flag}
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
                    <div className="w-full rounded-lg bg-white px-3.5 py-1.5 text-left">
                      <div className="text-[10px] text-gray-500">Phone</div>
                      <div className="flex items-center gap-1 text-[13px] text-black">
                        <span>{dial}</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full min-w-0 bg-transparent outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {err && <p className="text-xs" style={{ color: cfg.accent }}>{err}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1.5 w-full rounded-lg px-4 py-2.5 text-[14px] font-semibold disabled:opacity-60"
                style={{ background: cfg.accent, color: cfg.bg }}
              >
                {busy ? "…" : "Join"}
              </button>
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
