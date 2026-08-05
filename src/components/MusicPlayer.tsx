"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  /* The globe spins from the moment the page loads, not only once audio is
     actually playing — browsers block autoplay until the visitor interacts, so
     tying the animation to `playing` left it sitting frozen on arrival. It
     only stops when they deliberately press pause. */
  const [stopped, setStopped] = useState(false);
  const pathname = usePathname();
  const onAdmin = pathname.startsWith("/admin");

  // Match the original site: music starts by itself. Browsers block autoplay
  // until the user interacts, so fall back to starting on the first tap/scroll/key.
  useEffect(() => {
    if (onAdmin) return;
    const a = audioRef.current;
    if (!a) return;
    let started = false;
    const start = () => {
      if (started) return;
      a.play().then(() => {
        started = true;
        setPlaying(true);
        cleanup();
      }).catch(() => {});
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    const cleanup = () => events.forEach((e) => removeEventListener(e, start));
    start();
    events.forEach((e) => addEventListener(e, start, { passive: true }));
    return cleanup;
  }, [onAdmin]);

  if (onAdmin) return null;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      setStopped(true);
    } else {
      setStopped(false);
      a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1">
      <audio ref={audioRef} src="/site/music.mp3" loop preload="none" />
      <Image
        src="/site/earth.png"
        alt="music-cover"
        width={70}
        height={70}
        className={stopped ? "" : "animate-spin-slow"}
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause music" : "Play music"}
        className="cursor-pointer leading-none text-[#FE0000]"
      >
        {/* Drawn as SVG rather than the ▶ / ❚❚ characters: phones render those
            as full-colour emoji, which is why the control looked wrong on
            mobile but fine on desktop. */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          {playing ? (
            <>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
          ) : (
            <path d="M7 4.5v15a1 1 0 0 0 1.54.84l11.2-7.5a1 1 0 0 0 0-1.68L8.54 3.66A1 1 0 0 0 7 4.5Z" />
          )}
        </svg>
      </button>
    </div>
  );
}
