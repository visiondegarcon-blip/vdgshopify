"use client";
import { useEffect, useState } from "react";
import { sessionId } from "@/lib/track";
import { COUNTRY_NAMES } from "@/lib/countries";

export type LockSocial = { label: string; url: string };

export type LockConfig = {
  enabled: boolean;
  scope: "store" | "site";
  ends_at: string;

  heading: string;
  body: string;
  button_label: string;
  success_text: string;

  layout: "centered" | "split" | "minimal" | "fullscreen";
  align: "center" | "left";
  heading_size: "sm" | "md" | "lg" | "xl";
  font_head: string;
  font_body: string;

  image: string;
  image_size: number;
  bg_image: string;
  bg_overlay: number;

  bg: string;
  fg: string;
  accent: string;

  digit_style: "plain" | "boxed" | "circle";
  show_days: boolean;
  show_hours: boolean;
  show_minutes: boolean;
  show_seconds: boolean;
  show_unit_labels: boolean;
  hide_countdown: boolean;

  collect_email: boolean;
  collect_phone: boolean;
  collect_country: boolean;

  socials: LockSocial[];
  bypass_password: string;
  unlock_on_zero: boolean;
};

const HEADING_SIZE: Record<LockConfig["heading_size"], string> = {
  sm: "text-xl md:text-2xl",
  md: "text-2xl md:text-4xl",
  lg: "text-3xl md:text-5xl",
  xl: "text-4xl md:text-7xl",
};

const fontVar = (k: string) => (k ? `var(--font-${k})` : undefined);

function useCountdown(target: string) {
  const [ms, setMs] = useState(() => new Date(target).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setMs(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return ms;
}

/* Countdown units are opt-in individually. Hiding a larger unit rolls its time
   into the next one shown — hiding DAYS on a 3-day timer shows 72 hours, not
   0 hours — otherwise the number on screen would simply be wrong. */
function buildUnits(ms: number, cfg: LockConfig) {
  const total = Math.max(0, ms);
  const out: { value: number; label: string }[] = [];
  let rest = total;

  // Taking the remainder as we go is what makes the roll-up work: the first
  // unit shown absorbs everything above it.
  const push = (label: string, size: number, show: boolean) => {
    if (!show) return;
    const value = Math.floor(rest / size);
    rest -= value * size;
    out.push({ value, label });
  };

  push("DAYS", 864e5, cfg.show_days);
  push("HRS", 36e5, cfg.show_hours);
  push("MIN", 6e4, cfg.show_minutes);
  push("SEC", 1e3, cfg.show_seconds);
  return out;
}

export default function LockScreen({ config }: { config: LockConfig }) {
  const cfg = config;
  const ms = useCountdown(cfg.ends_at);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // only reload to reveal the store if the drop is meant to open itself
    if (ms <= 0 && cfg.unlock_on_zero) {
      const t = setTimeout(() => location.reload(), 1200);
      return () => clearTimeout(t);
    }
  }, [ms, cfg.unlock_on_zero]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, country, source: "countdown", sid: sessionId() }),
      });
      const j = await res.json();
      if (!res.ok) setErr(j.error ?? "Try again.");
      else setDone(true);
    } catch {
      setErr("Try again.");
    } finally {
      setBusy(false);
    }
  };

  const units = buildUnits(ms, cfg);
  const left = cfg.align === "left";
  const split = cfg.layout === "split";
  const fullscreen = cfg.layout === "fullscreen";
  // split renders the logo in its own column, so don't repeat it inline
  const showLogo = cfg.layout !== "minimal" && !!cfg.image && !split;

  const digitClass =
    cfg.digit_style === "boxed"
      ? "min-w-[2.6em] rounded-lg border px-3 py-2"
      : cfg.digit_style === "circle"
        ? "flex h-[2.8em] w-[2.8em] items-center justify-center rounded-full border"
        : "";
  const digitStyle =
    cfg.digit_style === "plain" ? undefined : { borderColor: `${cfg.accent}66` };

  const field = {
    background: "transparent",
    borderColor: cfg.fg,
    color: cfg.fg,
  } as const;

  const content = (
    <div
      className={`flex w-full max-w-xl flex-col ${left ? "items-start text-left" : "items-center text-center"}`}
      style={{ fontFamily: fontVar(cfg.font_body) }}
    >
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cfg.image}
          alt=""
          className="mb-8 w-auto object-contain"
          style={{ maxHeight: cfg.image_size }}
        />
      )}

      <h1
        className={`font-bold tracking-widest ${HEADING_SIZE[cfg.heading_size] ?? HEADING_SIZE.lg}`}
        style={{ fontFamily: fontVar(cfg.font_head) }}
      >
        {cfg.heading}
      </h1>

      {cfg.body && <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">{cfg.body}</p>}

      {!cfg.hide_countdown && units.length > 0 && (
        <div
          className="mt-10 flex gap-4 text-2xl md:gap-6 md:text-4xl"
          style={{ color: cfg.accent }}
        >
          {units.map((u) => (
            <div key={u.label} className="flex flex-col items-center">
              <span className={`font-bold tabular-nums ${digitClass}`} style={digitStyle}>
                {String(u.value).padStart(2, "0")}
              </span>
              {cfg.show_unit_labels && (
                <span
                  className="mt-2 text-[10px] tracking-[2px] opacity-70"
                  style={{ color: cfg.fg }}
                >
                  {u.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {(cfg.collect_email || cfg.collect_phone) && !done && (
        <form onSubmit={submit} className="mt-10 flex w-full max-w-sm flex-col gap-2">
          {cfg.collect_email && (
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border px-3 py-2 text-sm"
              style={field}
            />
          )}
          {cfg.collect_phone && (
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border px-3 py-2 text-sm"
              style={field}
            />
          )}
          {cfg.collect_country && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border px-3 py-2 text-sm"
              style={field}
            >
              <option value="" style={{ color: "#000" }}>
                Where are you?
              </option>
              {Object.entries(COUNTRY_NAMES)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([code, name]) => (
                  <option key={code} value={code} style={{ color: "#000" }}>
                    {name}
                  </option>
                ))}
            </select>
          )}
          {err && (
            <p className="text-xs" style={{ color: cfg.accent }}>
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ background: cfg.accent, color: cfg.bg }}
          >
            {busy ? "…" : cfg.button_label}
          </button>
        </form>
      )}

      {done && (
        <p className="mt-10 text-sm" style={{ color: cfg.accent }}>
          ✓ {cfg.success_text}
        </p>
      )}

      {cfg.socials?.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-4 text-xs uppercase tracking-widest opacity-70">
          {cfg.socials.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const bgLayer = cfg.bg_image
    ? {
        backgroundImage: `url(${JSON.stringify(cfg.bg_image)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-6"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      {cfg.bg_image && (
        <>
          <div className="absolute inset-0" style={bgLayer} aria-hidden />
          {/* keeps text readable over any photo */}
          <div
            className="absolute inset-0"
            style={{ background: cfg.bg, opacity: cfg.bg_overlay / 100 }}
            aria-hidden
          />
        </>
      )}

      <div
        className={`relative z-10 flex w-full ${
          split ? "max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-between" : "justify-center"
        } ${fullscreen ? "min-h-screen items-center" : ""}`}
      >
        {split && cfg.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfg.image}
            alt=""
            className="w-full max-w-sm object-contain"
            style={{ maxHeight: cfg.image_size * 2 }}
          />
        )}
        {split ? <div className="flex w-full md:w-1/2">{content}</div> : content}
      </div>
    </main>
  );
}
