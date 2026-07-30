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

/* Scroll-triggered signup popup, configured from the admin Marketing tab.
   Shows once, then stays hidden for 30 days (or forever after signup). */
export default function ScrollPopup() {
  const pathname = usePathname();
  const [cfg, setCfg] = useState<PopupConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, source: "popup", sid: sessionId() }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j.error ?? "Try again.");
    localStorage.setItem("vdg-popup-until", String(Date.now() + 3650 * 864e5));
    setCode(j.discount_code);
    track("popup_signup");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={dismiss}>
      <div
        className="relative w-full max-w-md overflow-hidden shadow-2xl"
        style={{ background: cfg.bg, color: cfg.fg, borderRadius: "var(--vdg-radius)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-2 text-xl opacity-70 hover:opacity-100"
        >
          ×
        </button>
        {cfg.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.image} alt="" className="h-44 w-full object-cover" />
        )}
        <div className="p-6 text-center">
          <h2 className="font-mono text-xl font-bold tracking-widest">{cfg.heading}</h2>
          <p className="mt-2 text-sm opacity-80">{cfg.body}</p>
          {code == null ? (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border px-3 py-2 text-sm"
                style={{ background: "transparent", borderColor: cfg.fg, color: cfg.fg }}
              />
              {cfg.collect_phone && (
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border px-3 py-2 text-sm"
                  style={{ background: "transparent", borderColor: cfg.fg, color: cfg.fg }}
                />
              )}
              {err && <p className="text-xs" style={{ color: cfg.accent }}>{err}</p>}
              <button
                type="submit"
                className="mt-1 px-4 py-2 font-mono text-sm font-bold"
                style={{ background: cfg.accent, color: cfg.bg }}
              >
                SIGN UP
              </button>
            </form>
          ) : (
            <div className="mt-4">
              <p className="text-sm">You&apos;re in. {code ? "Your code:" : ""}</p>
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
