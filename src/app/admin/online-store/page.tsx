"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminCall } from "../adminApi";

type Theme = { id: number; name: string; tokens: Record<string, string>; preset: boolean };
type Snapshot = { id: number; name: string; created_at: string };

/* Shopify-style "Online Store" section: web-vitals speed report + sessions
   by device, plus entry points to the editor, themes and lock. */

type Speed = {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  samples: { lcp: number; inp: number; cls: number };
  devices: Record<string, number>;
};

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;

function grade(metric: "lcp" | "inp" | "cls", v: number | null): { label: string; color: string; pct: number } {
  if (v == null) return { label: "No data yet", color: "text-gray-400", pct: 0 };
  const bounds = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] }[metric];
  if (v <= bounds[0]) return { label: "Good", color: "text-green-700", pct: Math.min(100, Math.round((bounds[0] / Math.max(v, 1e-6)) * 100)) };
  if (v <= bounds[1]) return { label: "Moderate", color: "text-amber-600", pct: Math.round((bounds[0] / v) * 100) };
  return { label: "Poor", color: "text-red-700", pct: Math.round((bounds[0] / v) * 100) };
}

const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet", other: "Other" };

export default function OnlineStorePage() {
  const [speed, setSpeed] = useState<Speed | null>(null);
  const [range, setRange] = useState<keyof typeof RANGES>("30d");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshDesign = () => {
    adminCall<{ themes: Theme[]; activeId: string | null }>("list_themes").then((r) => {
      setThemes(r.themes);
      setActiveId(r.activeId);
    });
    adminCall<{ snapshots: Snapshot[] }>("list_snapshots").then((r) => setSnapshots(r.snapshots));
  };

  useEffect(refreshDesign, []);

  useEffect(() => {
    adminCall<Speed>("speed_metrics", { days: RANGES[range] }).then(setSpeed).catch(() => {});
  }, [range]);

  const applyTheme = async (id: number) => {
    setBusy(`theme-${id}`);
    await adminCall("update_settings", { settings: { active_theme_id: String(id) } });
    setActiveId(String(id));
    setBusy(null);
  };

  const saveSnapshot = async () => {
    const name = prompt("Name this design (e.g. 'Pre-drop classic')");
    if (name == null) return;
    setBusy("snap");
    await adminCall("save_snapshot", { name });
    refreshDesign();
    setBusy(null);
  };

  const restoreSnapshot = async (id: number) => {
    if (!confirm("Restore this design? Current banner/theme/content will be replaced.")) return;
    setBusy(`restore-${id}`);
    await adminCall("restore_snapshot", { id });
    refreshDesign();
    setBusy(null);
  };

  const cards: { key: "lcp" | "inp" | "cls"; title: string; value: string; sub: string }[] = speed
    ? [
        { key: "lcp", title: "LCP P75", value: speed.lcp != null ? `${Math.round(speed.lcp)} ms` : "—", sub: `${speed.samples.lcp} samples` },
        { key: "inp", title: "INP P75", value: speed.inp != null ? `${Math.round(speed.inp)} ms` : "—", sub: `${speed.samples.inp} samples` },
        { key: "cls", title: "Cumulative Layout Shift", value: speed.cls != null ? `${speed.cls.toFixed(3)}` : "—", sub: `${speed.samples.cls} samples` },
      ]
    : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Online Store</h1>
        <div className="flex items-center gap-2">
          <a
            href="https://vdg-store.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            View store ↗
          </a>
          <Link
            href="/admin/online-store/editor"
            className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white"
          >
            Edit store
          </Link>
        </div>
      </div>

      <div className="mt-4 flex gap-1">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1 text-xs ${range === r ? "bg-[#1a1a1a] text-white" : "bg-white"}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Speed report */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const g = grade(c.key, speed?.[c.key] ?? null);
          return (
            <div key={c.key} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-[12px] font-medium text-gray-500">{c.title}</div>
              <div className="mt-1 text-2xl font-semibold">{c.value}</div>
              <div className={`mt-1 text-sm font-medium ${g.color}`}>{g.label}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-100">
                <div
                  className={`h-full ${g.label === "Good" ? "bg-green-600" : g.label === "Moderate" ? "bg-amber-500" : "bg-red-600"}`}
                  style={{ width: `${Math.min(100, g.pct)}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-gray-400">{c.sub}</div>
            </div>
          );
        })}
        {!speed && <div className="text-sm text-gray-500">Loading…</div>}
      </div>

      {/* Themes */}
      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Themes</div>
          <button
            onClick={saveSnapshot}
            disabled={busy === "snap"}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {busy === "snap" ? "Saving…" : "Save current site design"}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {themes.map((t) => {
            const tk = t.tokens;
            const active = String(t.id) === activeId;
            return (
              <div key={t.id} className={`rounded-xl border p-3 ${active ? "border-black" : "border-gray-200"}`}>
                <div
                  className="flex h-20 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ background: tk.bg, color: tk.fg, borderRadius: tk.radius }}
                >
                  <span style={{ color: tk.accent }}>VDG</span>&nbsp;{t.name}
                </div>
                <div className="mt-2 flex gap-1">
                  {[tk.bg, tk.accent, tk.bannerBg, tk.btnBg].map((c, i) => (
                    <span key={i} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{t.name}</span>
                  {active ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                      Active
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      <a
                        href={`/?preview_theme=${t.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-gray-300 px-2 py-0.5 text-[11px]"
                      >
                        Preview
                      </a>
                      <button
                        onClick={() => applyTheme(t.id)}
                        disabled={busy === `theme-${t.id}`}
                        className="rounded bg-[#1a1a1a] px-2 py-0.5 text-[11px] text-white disabled:opacity-60"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 p-3 text-center opacity-60">
            <div className="text-2xl">✦</div>
            <div className="mt-1 text-xs font-medium">Generate with AI</div>
            <div className="mt-1 text-[10px] text-gray-500">
              Type a vibe, get a theme. Connect an Anthropic API key to enable.
            </div>
          </div>
        </div>

        {snapshots.length > 0 && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <div className="text-[13px] font-semibold text-gray-600">Design history</div>
            <ul className="mt-2 flex flex-col gap-1">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                  <span>
                    {s.name}
                    <span className="ml-2 text-[11px] text-gray-400">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      onClick={() => restoreSnapshot(s.id)}
                      disabled={busy === `restore-${s.id}`}
                      className="text-xs underline disabled:opacity-50"
                    >
                      Restore
                    </button>
                    <button
                      onClick={async () => {
                        await adminCall("delete_snapshot", { id: s.id });
                        refreshDesign();
                      }}
                      className="text-xs text-red-700 underline"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sessions by device */}
      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold">Sessions by Device Type</div>
        {speed && Object.keys(speed.devices).length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            No visits recorded yet — data starts flowing as soon as this deploy is live.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          {speed &&
            Object.entries(speed.devices)
              .sort((a, b) => b[1] - a[1])
              .map(([device, count]) => {
                const total = Object.values(speed.devices).reduce((n, v) => n + v, 0) || 1;
                return (
                  <div key={device} className="flex items-center gap-3">
                    <span className="w-16 text-right text-lg font-semibold">{count}</span>
                    <div className="flex-1">
                      <div className="text-[13px]">{DEVICE_LABELS[device] ?? device}</div>
                      <div className="h-1.5 overflow-hidden rounded bg-gray-100">
                        <div className="h-full bg-[#1a1a1a]" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
