"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
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
    } else {
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
        className={playing ? "animate-spin-slow" : ""}
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause music" : "Play music"}
        className="text-[#FE0000] text-2xl leading-none cursor-pointer select-none"
      >
        {playing ? "❚❚" : "▶"}
      </button>
    </div>
  );
}
