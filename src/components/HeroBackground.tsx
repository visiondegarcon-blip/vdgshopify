"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

/* Home hero backgrounds — a single image, or a rotating set with crossfade
   when the editor's "rotating backgrounds" toggle is on. */
export default function HeroBackground({
  desktop,
  mobile,
  rotate,
  intervalS,
}: {
  desktop: string[];
  mobile: string;
  rotate: boolean;
  intervalS: number;
}) {
  const imgs = desktop.length ? desktop : ["/site/hero-desktop.png"];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!rotate || imgs.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % imgs.length), Math.max(3, intervalS) * 1000);
    return () => clearInterval(t);
  }, [rotate, imgs.length, intervalS]);

  return (
    <>
      {imgs.map((src, i) => (
        <Bg
          key={`${src}-${i}`}
          src={src}
          priority={i === 0}
          className="hidden object-cover transition-opacity duration-1000 md:block"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      <Bg src={mobile} priority className="object-cover md:hidden" />
    </>
  );
}

/* next/image throws a 500 for hosts missing from next.config remotePatterns,
   and admins can paste any URL — so only relative paths (local assets) go
   through the optimizer; everything else renders as a plain background img. */
function Bg({
  src,
  priority,
  className,
  style,
}: {
  src: string;
  priority: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  if (!src) return null;
  if (src.startsWith("/")) {
    return <Image src={src} alt="" fill priority={priority} sizes="100vw" className={className} style={style} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`absolute inset-0 h-full w-full ${className}`}
      style={style}
      loading={priority ? "eager" : "lazy"}
    />
  );
}
