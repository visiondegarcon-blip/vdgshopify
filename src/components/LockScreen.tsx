"use client";
import { useEffect, useState } from "react";
import { sessionId } from "@/lib/track";

export type LockConfig = {
  enabled: boolean;
  ends_at: string;
  heading: string;
  body: string;
  image: string;
  bg: string;
  fg: string;
  accent: string;
  collect_email: boolean;
  collect_phone: boolean;
};

function useCountdown(target: string) {
  const [ms, setMs] = useState(() => new Date(target).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setMs(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return ms;
}

export default function LockScreen({ config }: { config: LockConfig }) {
  const ms = useCountdown(config.ends_at);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ms <= 0) {
      const t = setTimeout(() => location.reload(), 1200);
      return () => clearTimeout(t);
    }
  }, [ms]);

  const d = Math.max(0, Math.floor(ms / 864e5));
  const h = Math.max(0, Math.floor((ms % 864e5) / 36e5));
  const m = Math.max(0, Math.floor((ms % 36e5) / 6e4));
  const s = Math.max(0, Math.floor((ms % 6e4) / 1e3));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, source: "countdown", sid: sessionId() }),
    });
    const j = await res.json();
    if (!res.ok) setErr(j.error ?? "Try again.");
    else setDone(true);
  };

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: config.bg, color: config.fg }}
    >
      {config.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={config.image} alt="" className="mb-8 max-h-48 w-auto object-contain" />
      )}
      <h1 className="font-mono text-3xl font-bold tracking-widest md:text-5xl">{config.heading}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">{config.body}</p>

      <div className="mt-10 flex gap-4 font-mono text-2xl md:gap-6 md:text-4xl" style={{ color: config.accent }}>
        {[
          [d, "DAYS"],
          [h, "HRS"],
          [m, "MIN"],
          [s, "SEC"],
        ].map(([v, label]) => (
          <div key={label as string} className="flex flex-col items-center">
            <span className="tabular-nums font-bold">{String(v).padStart(2, "0")}</span>
            <span className="mt-1 text-[10px] tracking-[2px] opacity-70" style={{ color: config.fg }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {(config.collect_email || config.collect_phone) && !done && (
        <form onSubmit={submit} className="mt-10 flex w-full max-w-sm flex-col gap-2">
          {config.collect_email && (
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border px-3 py-2 text-sm"
              style={{ background: "transparent", borderColor: config.fg, color: config.fg }}
            />
          )}
          {config.collect_phone && (
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border px-3 py-2 text-sm"
              style={{ background: "transparent", borderColor: config.fg, color: config.fg }}
            />
          )}
          {err && <p className="text-xs" style={{ color: config.accent }}>{err}</p>}
          <button
            type="submit"
            className="mt-1 px-4 py-2 font-mono text-sm font-bold"
            style={{ background: config.accent, color: config.bg }}
          >
            NOTIFY ME
          </button>
        </form>
      )}
      {done && (
        <p className="mt-10 font-mono text-sm" style={{ color: config.accent }}>
          ✓ You&apos;re on the list.
        </p>
      )}
    </main>
  );
}
