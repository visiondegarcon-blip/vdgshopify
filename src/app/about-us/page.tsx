"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

/* About page — redesigned 2026-07 per Daniel: same copy, VDG zine aesthetic
   (black blocks, mono type, red accents, filmstrip archive) instead of the
   long vertical Shopify page. */

const TABS = ["What Is VDG", "Brand Mission", "Our Future"] as const;

const SECTIONS: Record<(typeof TABS)[number], { heading: string; body: string }[]> = {
  "What Is VDG": [
    {
      heading: "What Is Vision De Garçon™",
      body: "Vision De Garçon™ or (VDG) was created as a humanitarian platform to shine a light on global issues overlooked by mainstream media — a voice for the unspoken, telling their stories through various forms of art, clothing and creative expression.",
    },
    {
      heading: "The Meaning Behind The Name",
      body: "Vision De Garçon, French for The Boy's Vision, was chosen as a testament to all the boys and girls around the world who had the same dreams and visions as us but couldn't get to live them out due to factors like poverty, war etc.",
    },
  ],
  "Brand Mission": [
    {
      heading: "Clothing is just the beginning!",
      body: "Bracelets, paintings, poems, necklaces — who said art has borders? There are poets who've never shared their words. Painters whose work has never left their room. Musicians who only play for empty streets. Designers with visions bigger than their resources. We're here to change that. This isn't just about selling products — it's about amplifying voices. Clothing? Just our first canvas.",
    },
    {
      heading: "Host events",
      body: "Open mics, art exhibitions, candlelight vigils for causes that matter. Document stories — travel, listen, and share the raw, real narratives of people who inspire us.",
    },
    {
      heading: "Collaborate",
      body: "Not compete — build a network where creators lift each other up. A street artist from Lagos alongside a designer from Tokyo. A poet from Chicago with a musician from Berlin. A small-town jewelry maker with the same exposure as a high-end brand. Creativity isn't confined by borders, budgets, or barriers. If your art ever felt too \"different\", too \"unknown\" — this is your sign.",
    },
  ],
  "Our Future": [
    {
      heading: "Our Future",
      body: "Beyond awareness and donating to charities, our main goal is to grow into a platform where people who want to go out to these countries and give aid first-hand can do so. And on these trips, through film and raw storytelling, capture the human experience. The smiles, the struggles, the shared meals, the laughter from late-night fireplace conversations — the stories that remind us: no matter where we're from, we're all living the same story, on the same planet.",
    },
  ],
};

const ARCHIVE: { img: string; title: string; fact: string; credit: string }[] = [
  {
    img: "/about/Paris_is_Burning.jpg",
    title: `"Rire à la Rue" (Laughter in the Streets)`,
    fact: "Marseille's housing projects are 80% Arab yet 0% of the city's tourism ads.",
    credit: "Élodie Baptiste — Avocats Sans Frontières France",
  },
  {
    img: "/about/Angola.jpg",
    title: `"Salon Lessons"`,
    fact: "In Africa, certain braid patterns were used to hide seeds, show tribal status, or even map routes from slave traders.",
    credit: "Carolina 'Caro' Jiménez (DR)",
  },
  {
    img: "/about/ccc18878-7ef1-40f8-8bb7-4adb7873b7ea.jpg",
    title: `"Rent Due Mix Vol. 1"`,
    fact: "NYC street performers get ticketed every 53 minutes on average.",
    credit: `Theophilé "Te Gwap" Habimana`,
  },
  {
    img: "/about/richmonddoll.jpg",
    title: `"¡Cuatro manos una llama!"`,
    fact: "In the Caribbean favelas the average family cooks on 1 gas stove and uses 27% less water per meal than Michelin chefs. Efficiency isn't taught here — it's survival.",
    credit: "Unknown",
  },
  {
    img: "/about/6.jpg",
    title: `"Water That Costs More Than Water"`,
    fact: `The human brain identifies Coca-Cola's silhouette faster than the "nike swoosh." Some cravings don't need translation.`,
    credit: "Noor Haddad",
  },
  {
    img: "/about/Baseball_in_Trinidad_-_A_bunch_of_Cuban_kids_playing_baseball_barefoot_down_the_streets.jpg",
    title: `"Azúcar, Sudor Y Cambios De Humor"`,
    fact: "60% of Caribbean pros started playing with taped-up rocks as balls.",
    credit: "Unknown",
  },
  {
    img: "/about/5.jpg",
    title: `"Eja. Plantain. Tun ṣe."`,
    fact: "The plantain's journey mirrors the black diaspora: enslaved Africans planted shoots in their hair across the Americas. 1 in 3 Caribbean meals still begins with its peel.",
    credit: "Adejoké Bakare — Michelin Chef",
  },
  {
    img: "/about/Peruvian_Amazon.jpg",
    title: `"Mi Primer Dia"`,
    fact: "These girls will study 3 extra years on average compared to their grandmothers.",
    credit: "Unknown",
  },
  {
    img: "/about/mother_and_baby_MRI.jpg",
    title: `"A Mothers Love"`,
    fact: "In 85% of cultures worldwide, mothers instinctively kiss their child's forehead exactly where the MRI's warmth appears — a biological reset button for fear.",
    credit: "Dr. Trinh Nguyen — University of Vienna",
  },
  {
    img: "/about/7.jpg",
    title: `"Trial At São Paulo"`,
    fact: "Rio's favelas produce more pro players than most academies.",
    credit: "Olivera De Ribero — Joga TV Brazil",
  },
  {
    img: "/about/MYTHODEA.jpg",
    title: `"اللي يشتيلون البراميل بدال العيال"`,
    fact: "Women in Sudan walk 7km daily; the water usually weighing more than their toddlers.",
    credit: "Sameria Abu Salmiya — Al Jazeera",
  },
];

export default function AboutPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("What Is VDG");
  return (
    <main className="min-h-screen bg-white">
      <Header showCart={false} />

      {/* Manifesto block */}
      <section className="bg-black px-4 py-14 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-xs tracking-[4px] text-[#FE0000]">A VOICE FOR THE UNSPOKEN</div>
          <h1 className="mt-2 font-mono text-4xl font-bold tracking-tight md:text-6xl">
            WHAT IS VDG?
          </h1>
          <div className="mt-8 flex gap-2 font-mono text-xs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border px-3 py-1.5 transition-colors ${
                  tab === t
                    ? "border-white bg-white text-black"
                    : "border-white/40 text-white/70 hover:border-white hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {SECTIONS[tab].map((s, i) => (
              <div key={s.heading} className={SECTIONS[tab].length === 1 ? "md:col-span-2" : ""}>
                <div className="font-mono text-xs text-[#FE0000]">{String(i + 1).padStart(2, "0")}</div>
                <h2 className="mt-1 font-mono text-sm font-bold uppercase tracking-widest">{s.heading}</h2>
                <p className="mt-3 text-[13px] leading-relaxed text-white/85">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Archive filmstrip */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-xl font-bold tracking-widest">THE ARCHIVE</h2>
            <span className="font-mono text-xs text-gray-500">did you know? — scroll →</span>
          </div>
        </div>
        <div className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:thin]">
          {ARCHIVE.map((a, i) => (
            <figure
              key={a.title}
              className="w-[270px] shrink-0 snap-start border border-black/10 bg-white md:w-[320px]"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt={a.title} className="h-[340px] w-full object-cover md:h-[400px]" />
                <span className="absolute left-2 top-2 bg-black px-1.5 py-0.5 font-mono text-[11px] text-white">
                  {String(i + 1).padStart(2, "0")}/{String(ARCHIVE.length).padStart(2, "0")}
                </span>
              </div>
              <figcaption className="p-3">
                <div className="font-mono text-[12px] font-bold leading-snug">{a.title}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-gray-700">
                  <span className="font-mono text-[#a51b1b]">did you know? </span>
                  {a.fact}
                </p>
                <div className="mt-2 font-mono text-[10px] text-gray-400">{a.credit}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Outro */}
      <section className="border-t border-black/10 px-4 py-14 text-center">
        <div className="font-mono text-lg font-bold tracking-[3px]">VIVA LA VISION DE GARÇON</div>
        <div className="mt-6 flex items-center justify-center gap-6">
          <Link href="/store" className="bg-black px-5 py-2 font-mono text-sm text-white">
            Store
          </Link>
          <Link href="/" className="font-mono text-sm underline underline-offset-4">
            Back Home
          </Link>
        </div>
        <div className="mt-10 tracking-[3px]">Rideaux</div>
      </section>
    </main>
  );
}
