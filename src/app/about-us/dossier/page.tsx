"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { TABS, SECTIONS, ARCHIVE, type Tab } from "../content";

/* Direction A: DOSSIER
   Underground newspaper. Masthead rule, multi-column editorial grid,
   photos set as clippings with the "did you know" facts as pull-quotes. */

export default function AboutDossier() {
  const [tab, setTab] = useState<Tab>("What Is VDG");
  const lead = ARCHIVE[0];
  const rest = ARCHIVE.slice(1);

  return (
    <main className="min-h-screen bg-[#faf9f7] text-black">
      <Header showCart={false} />

      <div className="mx-auto max-w-6xl px-5 pb-24">
        {/* Masthead */}
        <div className="border-y-4 border-black py-3">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-mono text-3xl font-bold uppercase leading-none tracking-tight md:text-5xl">
              What Is VDG?
            </h1>
            <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-widest text-[#a51b1b] md:block">
              A voice for the unspoken
            </span>
          </div>
        </div>

        {/* Editorial columns */}
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.6fr]">
          <aside className="md:border-r md:border-black/20 md:pr-8">
            <div className="flex flex-col items-start gap-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`w-full border-b border-black/15 py-2 text-left font-mono text-[13px] transition-colors ${
                    tab === t ? "font-bold text-[#a51b1b]" : "text-black/60 hover:text-black"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <figure className="mt-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.img} alt={lead.title} className="w-full grayscale" />
              <figcaption className="mt-2 font-mono text-[11px] leading-snug text-black/60">
                {lead.title}. {lead.place}.
              </figcaption>
            </figure>
          </aside>

          <div>
            {SECTIONS[tab].map((s, i) => (
              <section key={s.heading} className={i > 0 ? "mt-7" : ""}>
                <h2 className="font-mono text-base font-bold uppercase tracking-wide">{s.heading}</h2>
                <p
                  className={`mt-2 text-[15px] leading-[1.7] ${
                    i === 0 ? "md:columns-2 md:gap-7 [&::first-letter]:float-left [&::first-letter]:pr-2 [&::first-letter]:font-mono [&::first-letter]:text-[52px] [&::first-letter]:font-bold [&::first-letter]:leading-[0.8]" : ""
                  }`}
                >
                  {s.body}
                </p>
              </section>
            ))}

            <blockquote className="mt-8 border-l-4 border-[#a51b1b] pl-5">
              <p className="font-mono text-[15px] font-bold leading-snug">{lead.fact}</p>
              <cite className="mt-2 block font-mono text-[11px] not-italic text-black/50">
                {lead.credit}
              </cite>
            </blockquote>
          </div>
        </div>

        {/* Archive as newsprint clippings */}
        <div className="mt-16 border-t-4 border-black pt-3">
          <h2 className="font-mono text-lg font-bold uppercase tracking-widest">The Archive</h2>
        </div>

        <div className="mt-6 columns-1 gap-7 md:columns-2 lg:columns-3">
          {rest.map((a) => (
            <figure key={a.title} className="mb-7 break-inside-avoid border-b border-black/15 pb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.img}
                alt={a.title}
                className="w-full grayscale transition-[filter] duration-300 hover:grayscale-0"
              />
              <figcaption className="mt-3">
                <h3 className="font-mono text-[13px] font-bold uppercase leading-snug">{a.title}</h3>
                <div className="font-mono text-[11px] text-black/45">{a.place}</div>
                <p className="mt-2 text-[13px] leading-relaxed">
                  <span className="font-mono font-bold text-[#a51b1b]">Did you know? </span>
                  {a.fact}
                </p>
                <div className="mt-2 font-mono text-[10px] text-black/40">{a.credit}</div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 border-t-4 border-black pt-6 text-center">
          <div className="font-mono text-base font-bold tracking-[3px]">VIVA LA VISION DE GARÇON</div>
          <div className="mt-5 flex items-center justify-center gap-5">
            <Link href="/store" className="bg-black px-5 py-2 font-mono text-sm text-white">
              Store
            </Link>
            <Link href="/" className="font-mono text-sm underline underline-offset-4">
              Back Home
            </Link>
          </div>
          <div className="mt-8 tracking-[3px] text-black/50">Rideaux</div>
        </div>
      </div>
    </main>
  );
}
