"use client";
import { useEffect, useRef, useState } from "react";
import Globe3D from "./Globe3D";
import { adminCall, fmt } from "../adminApi";

/* Shopify-style Live View: left column of stat cards (visitors, sales,
   sessions, orders, customer behavior, sessions by location) and a big
   light draggable globe with pulsing markers. Polls every 5s. */

type Live = {
  liveVisitors: { country: string | null; city: string | null; path: string | null }[];
  liveCount: number;
  sessionsToday: number;
  viewsToday: number;
  ordersToday: number;
  salesToday: number;
  behavior: { activeCarts: number; checkingOut: number; purchased: number };
  locations: [string, number][];
  topPages: [string, number][];
};

// coarse country -> [lat, lng] centroids for the marker layer
const GEO: Record<string, [number, number]> = {
  AU: [-25, 134], FR: [46, 2], US: [39, -98], GB: [54, -2], CA: [56, -106],
  DE: [51, 10], NL: [52, 5], BE: [50, 4], CH: [47, 8], IT: [42, 12],
  ES: [40, -4], PT: [39, -8], IE: [53, -8], BR: [-14, -52], JP: [36, 138],
  NZ: [-41, 174], ID: [-2, 118], IN: [21, 78], CN: [35, 103], KR: [36, 128],
  SG: [1, 104], MY: [4, 102], TH: [15, 101], PH: [13, 122], VN: [16, 106],
  ZA: [-29, 24], NG: [9, 8], KE: [0, 38], CD: [-3, 23], RW: [-2, 30],
  MX: [23, -102], AR: [-34, -64], CL: [-30, -71], CO: [4, -73], PE: [-10, -76],
  SE: [62, 15], NO: [61, 9], DK: [56, 10], FI: [64, 26], PL: [52, 20],
  AT: [47, 13], CZ: [50, 15], GR: [39, 22], TR: [39, 35], AE: [24, 54],
  SA: [24, 45], EG: [27, 30], MA: [32, -6], DZ: [28, 2], TN: [34, 9],
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="text-[12px] font-medium text-gray-700 underline decoration-dotted underline-offset-4">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function LiveView() {
  const [live, setLive] = useState<Live | null>(null);
  const markersRef = useRef<{ location: [number, number]; size: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await adminCall<Live>("live_view");
        if (cancelled) return;
        setLive(r);
        const counts = new Map<string, number>();
        for (const v of r.liveVisitors) {
          if (v.country && GEO[v.country]) counts.set(v.country, (counts.get(v.country) ?? 0) + 1);
        }
        markersRef.current = [...counts.entries()].map(([c, n]) => ({
          location: GEO[c],
          size: Math.min(0.06 + n * 0.03, 0.18),
        }));
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);


  const maxLoc = Math.max(1, ...(live?.locations.map(([, n]) => n) ?? [1]));

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
      {/* left column — Shopify-style stat cards */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live View <span className="font-normal text-gray-400">· just now</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Visitors right now" value={live ? String(live.liveCount) : "—"} />
          <StatCard label="Total sales" value={live ? fmt(live.salesToday) : "—"} />
          <StatCard label="Sessions" value={live ? String(live.sessionsToday) : "—"} />
          <StatCard label="Orders" value={live ? String(live.ordersToday) : "—"} />
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold underline decoration-dotted underline-offset-4">
            Customer behavior
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-gray-100">
            {(
              [
                ["Active carts", live?.behavior.activeCarts],
                ["Checking out", live?.behavior.checkingOut],
                ["Purchased", live?.behavior.purchased],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="px-3 first:pl-0">
                <div className="text-[12px] text-gray-600">{k}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{v ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold underline decoration-dotted underline-offset-4">
            Sessions by location
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {live?.locations.map(([loc, n]) => (
              <div key={loc}>
                <div className="text-[12px] text-gray-600">{loc}</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-6 overflow-hidden rounded bg-gray-100" style={{ width: "88%" }}>
                    <div className="h-full rounded bg-[#33b3e5]" style={{ width: `${(n / maxLoc) * 100}%` }} />
                  </div>
                  <span className="text-[12px] text-gray-500">{n}</span>
                </div>
              </div>
            ))}
            {live && live.locations.length === 0 && (
              <p className="text-[13px] text-gray-400">No sessions yet today.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold underline decoration-dotted underline-offset-4">
            Top pages
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {live?.topPages.map(([p, n]) => (
              <li key={p} className="flex justify-between">
                <span className="truncate">{p}</span>
                <span className="ml-2 text-gray-400">{n}</span>
              </li>
            ))}
            {live && live.topPages.length === 0 && <li className="text-[13px] text-gray-400">Nothing yet today.</li>}
          </ul>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold underline decoration-dotted underline-offset-4">
            Active visitor locations
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {live?.liveVisitors.slice(0, 6).map((v, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5a3ff0]" />
                  {[v.city, v.country].filter(Boolean).join(", ") || "Unknown"}
                </span>
                <span className="truncate text-[12px] text-gray-400">{v.path}</span>
              </li>
            ))}
            {live && live.liveVisitors.length === 0 && (
              <li className="text-[13px] text-gray-400">No one on the site right now.</li>
            )}
          </ul>
        </div>
      </div>

      {/* right — big light globe */}
      <div className="relative min-h-[520px] overflow-hidden rounded-xl">
        <Globe3D
          markersRef={markersRef}
          style={{
            width: "min(100%, 860px)",
            aspectRatio: "1",
            margin: "0 auto",
          }}
        />
        <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-4 rounded-full bg-white/80 px-4 py-1.5 text-[12px] text-gray-700 shadow-sm backdrop-blur">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#6b4ef5]" /> Visitors right now
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400">Drag to rotate</span>
        </div>
      </div>
    </div>
  );
}
