"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Globe3D, { type GlobeMarker } from "./Globe3D";
import { adminCall, fmt } from "../adminApi";
import { countryName } from "@/lib/countries";

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
  orderCountries: [string, number][];
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
  const markersRef = useRef<GlobeMarker[]>([]);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const searchBox = useRef<HTMLDivElement>(null);
  // the poll runs on a timer and must see the current toggle, not the value
  // captured when its effect first ran
  const showPinsRef = useRef(true);
  const allMarkers = useRef<GlobeMarker[]>([]);

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
        allMarkers.current = [
          ...[...counts.entries()].map(([c, n]): GlobeMarker => ({
            location: GEO[c],
            size: Math.min(0.06 + n * 0.03, 0.18),
            kind: "visitor",
          })),
          ...(r.orderCountries ?? [])
            .filter(([c]) => GEO[c])
            .map(([c, n]): GlobeMarker => ({
              location: GEO[c],
              size: Math.min(0.07 + n * 0.02, 0.16),
              kind: "order",
            })),
        ];
        markersRef.current = showPinsRef.current ? allMarkers.current : [];
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // hide pins without tearing down the scene: the globe reads this ref each frame
  useEffect(() => {
    showPinsRef.current = showPins;
    markersRef.current = showPins ? allMarkers.current : [];
  }, [showPins]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchBox.current && !searchBox.current.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(GEO)
      .filter((c) => !q || countryName(c).toLowerCase().includes(q) || c.toLowerCase().includes(q))
      .sort((a, b) => countryName(a).localeCompare(countryName(b)))
      .slice(0, 8);
  }, [search]);

  const goTo = (code: string) => {
    setFocus(GEO[code]);
    setSearch(countryName(code));
    setShowList(false);
  };

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

      {/* right — big light globe with Shopify's map chrome */}
      <div className="relative min-h-[520px] overflow-hidden rounded-xl">
        <Globe3D
          markersRef={markersRef}
          zoom={zoom}
          focus={focus}
          style={{
            width: expanded ? "min(100%, 1100px)" : "min(100%, 860px)",
            aspectRatio: "1",
            margin: "0 auto",
          }}
        />

        {/* location search */}
        <div ref={searchBox} className="absolute left-1/2 top-3 w-[300px] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-gray-400">⌕</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowList(true); }}
              onFocus={() => setShowList(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) goTo(matches[0]);
                if (e.key === "Escape") setShowList(false);
              }}
              placeholder="Search location"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {showList && matches.length > 0 && (
            <ul className="mt-1.5 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {matches.map((c) => (
                <li key={c}>
                  <button
                    onClick={() => goTo(c)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    {countryName(c)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* top-right tools */}
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            onClick={() => setShowPins((v) => !v)}
            title={showPins ? "Hide markers" : "Show markers"}
            className={`h-9 w-9 rounded-lg border border-gray-200 text-sm shadow-sm ${
              showPins ? "bg-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            ◉
          </button>
          <button
            onClick={() => { setZoom(1); setFocus(null); setSearch(""); }}
            title="Reset view"
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-sm shadow-sm"
          >
            ⟳
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Shrink" : "Expand"}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-sm shadow-sm"
          >
            ⤢
          </button>
        </div>

        {/* zoom */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-lg leading-none shadow-sm"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-lg leading-none shadow-sm"
          >
            −
          </button>
        </div>

        {/* legend */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] text-gray-700 shadow-sm backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7334E8]" /> Orders
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] text-gray-700 shadow-sm backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2EB9F5]" /> Visitors right now
          </span>
        </div>
      </div>
    </div>
  );
}
