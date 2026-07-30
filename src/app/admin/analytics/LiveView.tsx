"use client";
import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { adminCall, fmt } from "../adminApi";

/* Shopify-style Live View: full-bleed dark panel, draggable rotating globe
   with glowing teal visitor markers, stat bar underneath. Polls every 5s. */

type Live = {
  liveVisitors: { country: string | null; city: string | null; path: string | null }[];
  liveCount: number;
  sessionsToday: number;
  viewsToday: number;
  ordersToday: number;
  salesToday: number;
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
  const pointer = useRef<{ startX: number; startY: number; basePhi: number; baseTheta: number } | null>(null);
  const rot = useRef({ phi: 0, theta: 0.22, auto: 0 });
  const [grabbing, setGrabbing] = useState(false);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let pulse = 0;
    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: 1000,
      height: 1000,
      phi: 0,
      theta: 0.22,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 24000,
      mapBrightness: 7,
      baseColor: [0.22, 0.27, 0.36],
      markerColor: [0.1, 0.95, 0.65],
      glowColor: [0.12, 0.16, 0.24],
      markers: [],
    });
    const frame = () => {
      pulse += 0.06;
      if (!pointer.current) rot.current.auto += 0.0022; // gentle spin unless dragging
      const beat = 1 + 0.35 * Math.sin(pulse); // pulsing marker halo
      globe.update({
        phi: rot.current.phi + rot.current.auto,
        theta: rot.current.theta,
        markers: markersRef.current.map((m) => ({ ...m, size: m.size * beat })),
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: PointerEvent) => {
      pointer.current = {
        startX: e.clientX,
        startY: e.clientY,
        basePhi: rot.current.phi,
        baseTheta: rot.current.theta,
      };
      canvas.setPointerCapture(e.pointerId);
      setGrabbing(true);
    };
    const move = (e: PointerEvent) => {
      if (!pointer.current) return;
      rot.current.phi = pointer.current.basePhi + (e.clientX - pointer.current.startX) * 0.006;
      rot.current.theta = Math.min(
        1.1,
        Math.max(-0.6, pointer.current.baseTheta + (e.clientY - pointer.current.startY) * 0.004)
      );
    };
    const up = () => {
      pointer.current = null;
      setGrabbing(false);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      globe.destroy();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl bg-[#0b0e14] shadow-sm">
      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          style={{
            width: "min(100%, 620px)",
            aspectRatio: "1",
            display: "block",
            cursor: grabbing ? "grabbing" : "grab",
            touchAction: "none",
          }}
        />
        <div className="pointer-events-none absolute left-5 top-5 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[2px] text-white/70">Live</span>
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums">{live?.liveCount ?? "—"}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[2px] text-white/50">
            {live?.liveCount === 1 ? "Visitor" : "Visitors"} right now
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 right-5 text-[10px] uppercase tracking-[2px] text-white/30">
          Drag to rotate
        </div>
        <div className="pointer-events-none absolute right-5 top-5 hidden w-56 flex-col gap-3 md:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[2px] text-white/40">Active locations</div>
            <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-white/85">
              {live?.liveVisitors.slice(0, 6).map((v, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {[v.city, v.country].filter(Boolean).join(", ") || "Unknown"}
                  </span>
                  <span className="truncate text-[11px] text-white/40">{v.path}</span>
                </li>
              ))}
              {live && live.liveVisitors.length === 0 && (
                <li className="text-white/35">No one on the site right now.</li>
              )}
            </ul>
          </div>
          {live && live.topPages.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[2px] text-white/40">Top pages today</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-white/85">
                {live.topPages.slice(0, 4).map(([p, n]) => (
                  <li key={p} className="flex justify-between gap-2">
                    <span className="truncate">{p}</span>
                    <span className="text-white/40">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 md:grid-cols-4">
        {(
          [
            ["Visitors right now", live ? String(live.liveCount) : "—"],
            ["Total sales today", live ? fmt(live.salesToday) : "—"],
            ["Sessions today", live ? String(live.sessionsToday) : "—"],
            ["Orders today", live ? String(live.ordersToday) : "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-[#0b0e14] px-5 py-4">
            <div className="text-[11px] text-white/45">{k}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
