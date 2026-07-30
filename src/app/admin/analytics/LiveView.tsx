"use client";
import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { adminCall } from "../adminApi";

/* Shopify-style live view: rotating globe with a dot per active visitor
   (last 5 minutes), refreshed every 5 seconds. */

type Live = {
  liveVisitors: { country: string | null; city: string | null; path: string | null }[];
  liveCount: number;
  sessionsToday: number;
  viewsToday: number;
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

export default function LiveView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
          size: Math.min(0.1 + n * 0.04, 0.25),
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

  useEffect(() => {
    if (!canvasRef.current) return;
    let phi = 0;
    let raf = 0;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 900,
      height: 900,
      phi: 0,
      theta: 0.15,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 5,
      baseColor: [0.12, 0.12, 0.14],
      markerColor: [1, 0.23, 0.19],
      glowColor: [0.08, 0.08, 0.1],
      markers: [],
    });
    const spin = () => {
      phi += 0.004;
      globe.update({ phi, markers: markersRef.current });
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
    };
  }, []);

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden rounded-xl bg-[#05070d] shadow-sm">
        <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: "1", display: "block" }} />
        <div className="absolute left-4 top-4 text-white">
          <div className="text-3xl font-bold">{live?.liveCount ?? "—"}</div>
          <div className="text-[11px] uppercase tracking-[2px] text-white/60">
            {live?.liveCount === 1 ? "Visitor" : "Visitors"} right now
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[12px] text-gray-500">Sessions today</div>
          <div className="text-2xl font-semibold">{live?.sessionsToday ?? "—"}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[12px] text-gray-500">Page views today</div>
          <div className="text-2xl font-semibold">{live?.viewsToday ?? "—"}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[12px] font-semibold text-gray-600">Active visitor locations</div>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {live?.liveVisitors.slice(0, 8).map((v, i) => (
              <li key={i} className="flex justify-between">
                <span>{[v.city, v.country].filter(Boolean).join(", ") || "Unknown"}</span>
                <span className="text-gray-400">{v.path}</span>
              </li>
            ))}
            {live && live.liveVisitors.length === 0 && (
              <li className="text-gray-400">No one on the site right now.</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-[12px] font-semibold text-gray-600">Top pages today</div>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {live?.topPages.map(([p, n]) => (
              <li key={p} className="flex justify-between">
                <span className="truncate">{p}</span>
                <span className="ml-2 text-gray-400">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
