"use client";
import { useRef, useState } from "react";

/* Shopify-style hover zoom for the product page: hovering the featured image
   opens a rounded lens beside the cursor showing a magnified crop centred on
   the point under the pointer. Handles object-contain letterboxing by mapping
   the cursor into the actually-drawn image area. Desktop pointers only —
   touch devices never fire mouse hover, so mobile is unaffected. */

const ZOOM = 2.4;
const LENS_W = 165;
const LENS_H = 260;
const GAP = 24; // distance from the cursor to the lens edge

export default function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [lens, setLens] = useState<{
    left: number;
    top: number;
    bgX: number;
    bgY: number;
    bgW: number;
    bgH: number;
  } | null>(null);

  const move = (e: React.MouseEvent) => {
    const box = wrap.current?.getBoundingClientRect();
    const el = img.current;
    if (!box || !el || !el.naturalWidth) return;

    // drawn-image rect inside the element (object-contain + object-top)
    const scale = Math.min(el.clientWidth / el.naturalWidth, el.clientHeight / el.naturalHeight);
    const drawnW = el.naturalWidth * scale;
    const drawnH = el.naturalHeight * scale;
    const offsetX = (el.clientWidth - drawnW) / 2; // horizontally centred
    const offsetY = 0; // object-top

    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const ix = x - offsetX;
    const iy = y - offsetY;
    if (ix < 0 || iy < 0 || ix > drawnW || iy > drawnH) {
      setLens(null);
      return;
    }

    const bgW = drawnW * ZOOM;
    const bgH = drawnH * ZOOM;
    const bgX = Math.max(0, Math.min(bgW - LENS_W, ix * ZOOM - LENS_W / 2));
    const bgY = Math.max(0, Math.min(bgH - LENS_H, iy * ZOOM - LENS_H / 2));

    // lens always sits to the LEFT of the cursor — it never flips sides, so the
    // eye doesn't have to chase it across the image. Clamped to the container
    // so it stays fully visible when the cursor nears the left edge.
    const left = Math.max(0, x - LENS_W - GAP);
    const top = Math.max(0, Math.min(box.height - LENS_H, y - LENS_H / 2));

    setLens({ left, top, bgX, bgY, bgW, bgH });
  };

  return (
    <div ref={wrap} className="relative" onMouseMove={move} onMouseLeave={() => setLens(null)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={src} alt={alt} className="max-h-[80vh] w-full object-contain object-top" />
      {lens && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-20 hidden rounded-xl border-2 border-black/70 bg-white bg-no-repeat shadow-2xl md:block"
          style={{
            left: lens.left,
            top: lens.top,
            width: LENS_W,
            height: LENS_H,
            backgroundImage: `url(${JSON.stringify(src)})`,
            backgroundSize: `${lens.bgW}px ${lens.bgH}px`,
            backgroundPosition: `-${lens.bgX}px -${lens.bgY}px`,
          }}
        />
      )}
    </div>
  );
}
