"use client";
import { useRef, useState } from "react";

/* Admin image preview you can drag to reposition — like Shopify's media
   focal-point editor. Stores an object-position string ("50% 30%") that the
   storefront applies wherever the image is cropped. */
export default function DragImage({
  src,
  pos,
  onChange,
  aspect = "4/3",
}: {
  src: string;
  pos?: string;
  onChange: (pos: string) => void;
  aspect?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const parse = (p?: string): [number, number] => {
    const m = (p ?? "50% 50%").match(/([\d.]+)%\s+([\d.]+)%/);
    return m ? [Number(m[1]), Number(m[2])] : [50, 50];
  };
  const [live, setLive] = useState<string | null>(null);
  const current = live ?? pos ?? "50% 50%";

  if (!src) return null;

  const down = (e: React.PointerEvent) => {
    const [px, py] = parse(current);
    drag.current = { x: e.clientX, y: e.clientY, px, py };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    // dragging the image right shows more of its left side → position decreases
    const nx = Math.max(0, Math.min(100, drag.current.px - ((e.clientX - drag.current.x) / r.width) * 100));
    const ny = Math.max(0, Math.min(100, drag.current.py - ((e.clientY - drag.current.y) / r.height) * 100));
    setLive(`${Math.round(nx)}% ${Math.round(ny)}%`);
  };
  const up = () => {
    if (drag.current && live) onChange(live);
    drag.current = null;
  };

  return (
    <div>
      <div
        ref={box}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="relative overflow-hidden rounded-lg border border-gray-200"
        style={{ aspectRatio: aspect, cursor: "grab", touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{ objectPosition: current }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] text-white">
          Drag the image to reposition
        </div>
      </div>
    </div>
  );
}
