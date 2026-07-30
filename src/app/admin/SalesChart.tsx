"use client";
import { useEffect, useState } from "react";
import { fmt } from "./adminApi";

/* Shared time-series chart with a bar ⇄ line toggle (choice remembered).
   Used by Analytics "Total sales over time" and Finance EOFY monthly. */

export default function SalesChart({
  series,
  height = 160,
}: {
  series: [string, number][];
  height?: number;
}) {
  const [type, setType] = useState<"bar" | "line">("bar");
  useEffect(() => {
    const saved = localStorage.getItem("vdg-chart-type");
    if (saved === "line" || saved === "bar") setType(saved);
  }, []);
  const pick = (t: "bar" | "line") => {
    setType(t);
    localStorage.setItem("vdg-chart-type", t);
  };

  const max = Math.max(...series.map(([, v]) => v), 1);

  return (
    <div>
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px]">
          {(["bar", "line"] as const).map((t) => (
            <button
              key={t}
              onClick={() => pick(t)}
              className={`rounded-md px-2 py-0.5 capitalize ${type === t ? "bg-[#1a1a1a] text-white" : "text-gray-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {type === "bar" ? (
        <div className="mt-3 flex items-end gap-[2px]" style={{ height }}>
          {series.map(([label, cents]) => (
            <div key={label} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-[#0a5df0]/80 transition-colors group-hover:bg-[#0a5df0]"
                style={{ height: `${(cents / max) * 100}%`, minHeight: cents > 0 ? 3 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {label}: {fmt(cents)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <LineChart series={series} height={height} max={max} />
      )}

      <div className="mt-2 flex justify-between text-[10px] text-gray-500">
        <span>{series[0]?.[0]}</span>
        <span>{series[series.length - 1]?.[0]}</span>
      </div>
    </div>
  );
}

function LineChart({ series, height, max }: { series: [string, number][]; height: number; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 300;
  const n = Math.max(series.length - 1, 1);
  const x = (i: number) => (i / n) * (W - 16) + 8;
  const y = (v: number) => H - 8 - (v / max) * (H - 24);
  const points = series.map(([, v], i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${H - 8} ${points} ${x(series.length - 1)},${H - 8}`;

  return (
    <div className="relative mt-3" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * n);
          setHover(Math.max(0, Math.min(series.length - 1, i)));
        }}
      >
        <polygon points={area} fill="#0a5df0" opacity={0.08} />
        <polyline points={points} fill="none" stroke="#0a5df0" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {series.map(([, v], i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 6 : series.length <= 40 ? 3.5 : 0} fill="#0a5df0" />
        ))}
      </svg>
      {hover != null && series[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] text-white"
          style={{ left: `${(hover / n) * 100}%` }}
        >
          {series[hover][0]}: {fmt(series[hover][1])}
        </div>
      )}
    </div>
  );
}
