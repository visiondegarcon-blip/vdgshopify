"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { TABS, SECTIONS, ARCHIVE, type Tab } from "../content";

/* Direction B: EXHIBITION
   Dark gallery. Manifesto as a quiet opening wall text, then each archive
   photograph gets a full viewport panel with the fact as wall label. */

export default function AboutExhibition() {
  const [tab, setTab] = useState<Tab>("What Is VDG");

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-[#f2f0ec]">
      <div className="[&_header_.bg-black]:bg-[#0b0b0b] [&_img]:invert">
        <Header showCart={false} />
      </div>

      {/* Wall text */}
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <h1 className="font-mono text-[13vw] font-bold leading-[0.85] tracking-tighter md:text-[7rem]">
          WHAT IS
          <br />
          VDG?
        </h1>

        <div className="mt-10 grid gap-10 md:grid-cols-[180px_1fr]">
          <div className="flex flex-col gap-2 md:sticky md:top-8 md:h-fit">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-left font-mono text-[13px] transition-colors ${
                  tab === t ? "text-[#FE0000]" : "text-white/40 hover:text-white"
                }`}
              >
                {tab === t ? "/ " : ""}
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-7">
            {SECTIONS[tab].map((s) => (
              <div key={s.heading}>
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-white/45">
                  {s.heading}
                </h2>
                <p className="mt-3 text-[17px] leading-[1.75] text-white/90">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery: one photograph per panel */}
      <section className="mt-24">
        {ARCHIVE.map((a, i) => (
          <article
            key={a.title}
            className="relative flex min-h-[100dvh] flex-col justify-center border-t border-white/10 px-6 py-16 md:flex-row md:items-center md:gap-12 md:px-12"
          >
            <div className="md:w-[58%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.img}
                alt={a.title}
                className="max-h-[70dvh] w-full object-contain md:object-left"
              />
            </div>
            <div className="mt-6 md:mt-0 md:w-[42%]">
              <div className="font-mono text-[11px] text-[#FE0000]">
                {String(i + 1).padStart(2, "0")} / {String(ARCHIVE.length).padStart(2, "0")}
              </div>
              <h3 className="mt-2 font-mono text-2xl font-bold leading-tight">{a.title}</h3>
              <div className="mt-1 font-mono text-xs text-white/45">{a.place}</div>
              <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/85">{a.fact}</p>
              <div className="mt-5 border-t border-white/15 pt-3 font-mono text-[11px] text-white/40">
                {a.credit}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="border-t border-white/10 px-6 py-24 text-center">
        <div className="font-mono text-xl font-bold tracking-[4px]">VIVA LA VISION DE GARÇON</div>
        <div className="mt-8 flex items-center justify-center gap-5">
          <Link href="/store" className="bg-white px-6 py-2.5 font-mono text-sm text-black">
            Store
          </Link>
          <Link href="/" className="font-mono text-sm text-white/70 underline underline-offset-4">
            Back Home
          </Link>
        </div>
        <div className="mt-12 tracking-[3px] text-white/30">Rideaux</div>
      </section>
    </main>
  );
}
