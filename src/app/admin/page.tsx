"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adminCall, fmt } from "./adminApi";
import Globe3D from "./analytics/Globe3D";
import { COUNTRY_NAMES, countryName } from "@/lib/countries";

/* Shopify-style home: a strip of headline metrics that expand into a chart,
   a greeting, and a search box that re-runs the whole dashboard scoped to one
   country. Deliberately free of "suggestion" cards — the numbers and the
   fulfil shortcut are the whole point. */

type Point = { day: string; sessions: number; prevSessions: number; salesCents: number; orders: number };
type Overview = {
  country: string;
  days: number;
  sessions: number;
  salesCents: number;
  orders: number;
  conversion: number;
  prev: { sessions: number; salesCents: number; orders: number; conversion: number };
  series: Point[];
  liveCount: number;
  countries: { code: string; views: number }[];
  topPages: [string, number][];
  topCities: [string, number][];
  topProducts: [string, number][];
};

type MetricKey = "sessions" | "salesCents" | "orders" | "conversion";
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "sessions", label: "Sessions" },
  { key: "salesCents", label: "Total sales" },
  { key: "orders", label: "Orders" },
  { key: "conversion", label: "Conversion rate" },
];

const RANGES = [7, 30, 90] as const;

function show(key: MetricKey, v: number) {
  if (key === "salesCents") return fmt(v);
  if (key === "conversion") return `${v.toFixed(v < 10 ? 1 : 0)}%`;
  return String(v);
}

/* Percent change vs the previous window of equal length. Growth from zero has
   no meaningful percentage, so it renders as a plain dash rather than ∞. */
function delta(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null;
  const pct = ((now - before) / before) * 100;
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return null;
  return { text: `${pct > 0 ? "" : "-"}${Math.abs(pct).toFixed(0)}%`, up: pct > 0 };
}

/* Sparkline + comparison line. Kept as raw SVG so the home page doesn't pull
   in a chart dependency for what is one polyline. */
function Chart({ data, metric }: { data: Point[]; metric: MetricKey }) {
  const W = 820, H = 210, PAD = 28;
  const val = (p: Point) =>
    metric === "salesCents" ? p.salesCents : metric === "orders" ? p.orders : p.sessions;
  const cur = data.map(val);
  const prev = data.map((p) => p.prevSessions);
  const comparable = metric === "sessions";
  const max = Math.max(1, ...cur, ...(comparable ? prev : []));
  const x = (i: number) => PAD + (i / Math.max(1, data.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Metric over time">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD} x2={W - PAD} y1={y(max * f)} y2={y(max * f)} stroke="#eee" />
          <text x={4} y={y(max * f) + 4} fontSize="10" fill="#999">
            {metric === "salesCents" ? Math.round((max * f) / 100) : Math.round(max * f)}
          </text>
        </g>
      ))}
      {comparable && (
        <path d={path(prev)} fill="none" stroke="#bcdffb" strokeWidth="2" strokeDasharray="4 4" />
      )}
      <path d={path(cur)} fill="none" stroke="#1f93e0" strokeWidth="2.5" strokeLinejoin="round" />
      {data.length > 1 && (
        <>
          <text x={PAD} y={H - 8} fontSize="10" fill="#999">
            {new Date(data[0].day).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </text>
          <text x={W - PAD} y={H - 8} fontSize="10" fill="#999" textAnchor="end">
            {new Date(data[data.length - 1].day).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </text>
        </>
      )}
    </svg>
  );
}

export default function AdminHome() {
  const [days, setDays] = useState<number>(30);
  const [country, setCountry] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [open, setOpen] = useState<MetricKey | null>(null);
  const [unfulfilled, setUnfulfilled] = useState(0);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // the decorative globe takes no data; it just needs the prop's shape
  const noMarkers = useRef<never[]>([]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";

  useEffect(() => {
    adminCall<{ unfulfilled: number }>("stats")
      .then((r) => setUnfulfilled(r.unfulfilled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminCall<Overview>("home_overview", { days, country })
      .then((r) => !cancelled && setData(r))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [days, country]);

  // close the suggestion list on an outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* Suggestions come from countries we actually have data for, plus any
     shippable country, so searching somewhere with no traffic yet still
     resolves instead of looking broken. */
  const suggestions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of data?.countries ?? []) seen.set(c.code, c.views);
    for (const code of Object.keys(COUNTRY_NAMES)) if (!seen.has(code)) seen.set(code, 0);
    const q = query.trim().toLowerCase();
    return [...seen.entries()]
      .filter(([code]) => !q || countryName(code).toLowerCase().includes(q) || code.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1] || countryName(a[0]).localeCompare(countryName(b[0])))
      .slice(0, 8);
  }, [data?.countries, query]);

  const pick = (code: string) => {
    setCountry(code);
    setQuery("");
    setFocused(false);
  };

  return (
    <div className="relative">
      {/* Decorative spinning globe, bleeding off the top-right corner like
          Shopify's. It sits behind everything and stays draggable, so the
          empty space up there is something rather than nothing. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-32 z-0 hidden select-none opacity-70 lg:block"
      >
        <Globe3D
          ghost
          markersRef={noMarkers}
          style={{ width: 760, height: 760, pointerEvents: "auto" }}
        />
      </div>

      {/* metric strip */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium"
          >
            {RANGES.map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
          {country && (
            <button
              onClick={() => setCountry("")}
              className="flex items-center gap-1.5 rounded-full bg-[#1a1a1a] px-3 py-1 text-xs text-white"
            >
              {countryName(country)} <span className="text-gray-400">✕</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {METRICS.map((m) => {
            const now = data ? (data[m.key] as number) : 0;
            const d = data ? delta(now, data.prev[m.key]) : null;
            return (
              <button
                key={m.key}
                onClick={() => setOpen(open === m.key ? null : m.key)}
                className={`rounded-lg px-3 py-1.5 text-left transition ${
                  open === m.key ? "bg-white shadow-sm" : "hover:bg-white/60"
                }`}
              >
                <div className="text-[11px] text-gray-500">{m.label}</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums text-[#1a1a1a]">
                    {data ? show(m.key, now) : "—"}
                  </span>
                  {d && (
                    <span className={`text-[11px] ${d.up ? "text-emerald-600" : "text-red-500"}`}>
                      {d.up ? "↗" : "↘"} {d.text}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          <div className="pl-2 text-right">
            <div className="text-[11px] text-gray-500">Live visitors</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="text-sm font-semibold tabular-nums">{data?.liveCount ?? 0}</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {open && data && (
        <div className="relative z-10 mt-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[13px] font-semibold">
                {METRICS.find((m) => m.key === open)!.label} over time
                {country && <span className="font-normal text-gray-500"> · {countryName(country)}</span>}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{show(open, data[open])}</div>
            </div>
            <button onClick={() => setOpen(null)} className="text-xs text-gray-400 hover:text-gray-700">
              Close
            </button>
          </div>
          <div className="mt-2">
            <Chart data={data.series} metric={open} />
          </div>
          {open === "sessions" && (
            <div className="flex items-center gap-4 text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[#1f93e0]" /> This period
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-[#bcdffb]" /> Previous
              </span>
            </div>
          )}
        </div>
      )}

      {/* greeting + country search */}
      <div className="relative z-10 mt-14 text-center">
        <h1 className="text-2xl font-semibold text-[#1a1a1a]">{greeting}</h1>
        <p className="mt-1 text-xl text-[#1a1a1a]">Let&apos;s continue growing the vision.</p>

        <div ref={boxRef} className="relative mx-auto mt-7 max-w-xl text-left">
          <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2.5 shadow-sm focus-within:shadow">
            <span className="text-gray-400">⌕</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) pick(suggestions[0][0]);
                if (e.key === "Escape") setFocused(false);
              }}
              placeholder="Search a country to see its stats…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {focused && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {suggestions.map(([code, views]) => (
                <li key={code}>
                  <button
                    onClick={() => pick(code)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{countryName(code)}</span>
                    <span className="text-[11px] text-gray-400">
                      {views ? `${views} views` : "no traffic yet"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {unfulfilled > 0 && (
          <Link
            href="/admin/orders"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm hover:shadow"
          >
            Fulfill orders
            <span className="rounded-md bg-[#ebebeb] px-1.5 text-xs font-semibold">{unfulfilled}</span>
          </Link>
        )}
      </div>

      {/* country breakdown — only meaningful once a country is selected */}
      {country && data && (
        <div className="relative z-10 mt-12 grid gap-4 md:grid-cols-3">
          {(
            [
              ["Top pages", data.topPages, (n: number) => `${n}`],
              ["Cities", data.topCities, (n: number) => `${n}`],
              ["Best sellers", data.topProducts, (n: number) => `${n} sold`],
            ] as const
          ).map(([title, rows, fmtN]) => (
            <div key={title} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-[13px] font-semibold">{title}</div>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {rows.map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="truncate">{k}</span>
                    <span className="shrink-0 text-gray-400">{fmtN(n)}</span>
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="text-[13px] text-gray-400">Nothing in {countryName(country)} yet.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
