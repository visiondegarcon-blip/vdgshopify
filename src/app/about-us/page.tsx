"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { TABS, SECTIONS, ARCHIVE, type Tab } from "./content";

/* The manifesto stays pinned on the left like a transmission, the archive
   runs past it as an incoming feed of grayscale clippings on the right. */

export default function AboutPage() {
  const [tab, setTab] = useState<Tab>("What Is VDG");

  return (
    <main className="min-h-screen bg-white text-black">
      <Header showCart={false} />

      <div className="mx-auto grid max-w-[1500px] gap-0 px-0 md:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
        {/* Pinned transmission */}
        <div className="bg-black px-6 py-12 text-white md:sticky md:top-0 md:h-[100dvh] md:overflow-y-auto md:px-10 md:py-14">
          <h1 className="font-mono text-5xl font-bold leading-[0.9] tracking-tighter md:text-7xl">
            WHAT IS
            <br />
            <span className="text-[#FE0000]">VDG</span>?
          </h1>

          <div className="mt-8 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border px-3 py-1.5 font-mono text-[12px] transition-colors ${
                  tab === t
                    ? "border-[#FE0000] bg-[#FE0000] text-white"
                    : "border-white/25 text-white/60 hover:border-white hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-7">
            {SECTIONS[tab].map((s) => (
              <div key={s.heading}>
                <h2 className="font-mono text-[13px] font-bold uppercase tracking-wide">
                  {s.heading}
                </h2>
                <p className="mt-2.5 max-w-[52ch] text-[14px] leading-[1.75] text-white/80">
                  {s.body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-4">
            <Link href="/store" className="bg-white px-5 py-2 font-mono text-sm text-black">
              Store
            </Link>
            <Link href="/" className="font-mono text-sm text-white/60 underline underline-offset-4">
              Back Home
            </Link>
          </div>
        </div>

        {/* Incoming feed */}
        <div className="px-5 py-12 md:px-8 md:py-14">
          <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
            <h2 className="font-mono text-sm font-bold uppercase tracking-[0.2em]">The Archive</h2>
            <span className="font-mono text-[11px] text-black/40">
              {ARCHIVE.length} entries
            </span>
          </div>

          {/* Clippings: grayscale until hover, masonry columns */}
          <div className="mt-7 columns-1 gap-6 sm:columns-2">
            {ARCHIVE.map((a, i) => (
              <article
                key={a.title}
                className="group mb-8 break-inside-avoid border-b border-black/12 pb-5"
              >
                <div className="bg-black/5 grayscale transition-[filter] duration-300 group-hover:grayscale-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.img} alt={a.title} className="w-full" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-[#FE0000]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-mono text-[13px] font-bold uppercase leading-snug">
                    {a.title}
                  </h3>
                </div>
                <div className="pl-6 font-mono text-[10px] text-black/45">{a.place}</div>
                <p className="mt-2 pl-6 text-[13px] leading-relaxed">
                  <span className="font-mono font-bold text-[#a51b1b]">Did you know? </span>
                  {a.fact}
                </p>
                <div className="mt-2 pl-6 font-mono text-[10px] text-black/40">{a.credit}</div>
              </article>
            ))}
          </div>

          <div className="mt-14 border-t-2 border-black pt-6 text-center">
            <div className="font-mono text-base font-bold tracking-[3px]">
              VIVA LA VISION DE GARÇON
            </div>
            <div className="mt-6 tracking-[3px] text-black/40">Rideaux</div>
          </div>
        </div>
      </div>
    </main>
  );
}
