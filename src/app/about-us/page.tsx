"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";

const TABS = ["What Is VDG", "Brand Mission", "Our Future"] as const;

const GALLERY: { img: string; title: string; body: string; credit: string }[] = [
  {
    img: "/about/Paris_is_Burning.jpg",
    title: `"Rire à la Rue" (Laughter in the Streets)`,
    body: `Two boys, teeth gleaming under Marseille's orange streetlights, their laughter bouncing off graffiti-tagged walls. The air smells of salt and stolen cigarettes. This is how they own the night not with money, but with the noise no police can arrest.\n\ndid you know?: Marseille's housing projects are 80% Arab yet 0% of the city's tourism ads.`,
    credit: "-Élodie Baptiste (Avocats Sans Frontières France)",
  },
  {
    img: "/about/Angola.jpg",
    title: `"Salon Lessons"`,
    body: `A kitchen chair becomes a salon. One woman braiding, another wincing from the tug, while a toddler stares, memorizing the ritual, generations of hands that can braid in the dark.\n\ndid you know?: In Africa, certain braid patterns were used to hide seeds, show tribal status, or even map routes from slave traders.`,
    credit: "-Carolina 'Caro' Jiménez (DR)",
  },
  {
    img: "/about/ccc18878-7ef1-40f8-8bb7-4adb7873b7ea.jpg",
    title: `"Rent Due Mix Vol. 1"`,
    body: `A DJ setup on a Bronx sidewalk table wobbling, speakers buzzing. He's crowd: commuters, cops, and a kid nodding along.\n\ndid you know?: NYC street performers get ticketed every 53 minutes on average.`,
    credit: `-Theophilé "Te Gwap" Habimana`,
  },
  {
    img: "/about/richmonddoll.jpg",
    title: `"¡Cuatro manos una llama!" (Four Hands One Flame)`,
    body: `Two women pivot between stove and counter like dancers in a fight. the air smells of palm oil and sweat. This isn't cooking. It's triage.\n\ndid you know?: In the carribean favelas, the average family cooks just 1 gas stove, and uses 27% less water per meal than Michelin chefs. Efficiency isn't taught here it's survival.`,
    credit: "-Unknown",
  },
  {
    img: "/about/6.jpg",
    title: `"Water That Costs More Than Water"`,
    body: `From soda to sprite the logo in arabic script, but the shape, the color, the click-hiss of the tab? we'd all know it blindfolded.\n\ndid you know?: The human brain identifies Coca Cola's silhouette faster than the "nike swoosh." Some cravings don't need translation.`,
    credit: "-Noor Haddad",
  },
  {
    img: "/about/Baseball_in_Trinidad_-_A_bunch_of_Cuban_kids_playing_baseball_barefoot_down_the_streets.jpg",
    title: `"Azúcar, Sudor Y Cambios De Humor" (Sugar, Sweat, and Swings)`,
    body: `A common sight on the streets of many carribean islands such as Cuba or DR.\n\ndid you know?: 60% of Caribbean pros started playing with taped-up rocks as balls.`,
    credit: "-Unknown",
  },
  {
    img: "/about/5.jpg",
    title: `"Eja. Plantain. Tun ṣe."`,
    body: `Wild caught fish + fried plantain a handshake staple dish across continents from kingston jamaica, to lagos nigeria a meal a lot call home.\n\ndid you know?: The plantain's journey mirrors the black diaspora: enslaved Africans planted shoots in their hair, planting them across the Americas. Today, 1 in 3 Caribbean meals still begins with its peel.`,
    credit: "-Adejoké Bakare (Michelin Chef)",
  },
  {
    img: "/about/Peruvian_Amazon.jpg",
    title: `"Mi Primer Dia"`,
    body: `Photo of two Peruvian girls on their first day of school.\n\ndid you know?: The traditional "tullpa" (stone stove) where their mothers cooked now burns later. These girls will study 3 extra years on average compared to their grandmothers.`,
    credit: "-Unknown",
  },
  {
    img: "/about/mother_and_baby_MRI.jpg",
    title: `"A Mothers Love"`,
    body: `This MRI scan reveals more than anatomy it captures the first scientifically documented "mother's kiss" activation pattern that synchronizes both heartbeats.\n\ndid you know?: In 85% of cultures worldwide, mothers instinctively kiss their child's forehead exactly where the MRI's warmth appears a biological reset button for fear.`,
    credit: "-Dr. Trinh Nguyen (University of Vienna)",
  },
  {
    img: "/about/7.jpg",
    title: `"Trial At São Paulo"`,
    body: `Group of aspiring football stars at a trial in São Paulo.\n\nDid you know?: Rio's favelas produce more pro players than most academies.`,
    credit: "-Olivera De Ribero (Joga TV Brazil)",
  },
  {
    img: "/about/MYTHODEA.jpg",
    title: `"اللي يشتيلون البراميل بدال العيال"`,
    body: `To some this may appear shocking but is sadly a common sight for a staggering 2 billion people globally.\n\nDid you know?: Women in Sudan walk 7km daily; the water usually weighing more than their toddlers.`,
    credit: "-Sameria Abu Salmiya (Al Jezzera)",
  },
];

const SECTIONS: Record<(typeof TABS)[number], { heading: string; body: string }[]> = {
  "What Is VDG": [
    {
      heading: "What Is Vision De Garçon™:",
      body: "Vision De Garçon™ or (VDG) was created as a humanitarian platform to shine a light on global issues overlooked by mainstream media a voice for the unspoken, telling their stories through various forms of art, clothing and creative expression.",
    },
    {
      heading: "The Meaning Behind The Name:",
      body: "The Name Vision De Garçon, French For The Boys Vision Was Chosen As A Testiment To All The Boys and Girls Around The World Who Had The Same Dreams And Visions As Us But Couldn't Get To Live Them Out Due To Factors Like Poverty, War Etc.",
    },
  ],
  "Brand Mission": [
    {
      heading: "Clothing is just the beginning!",
      body: "Whether it's bracelets, paintings, poems, necklaces who said art has borders? we believe there's so much talent out there waiting to be shown.\n\nThere are poets who've never shared their words. Painters whose work has never left their room. Musicians who only play for empty streets. Designers with visions bigger than their resources.\n\nWe're here to change that!\n\nThis isn't just about selling products it's about amplifying voices. Clothing? Just our first canvas. Bracelets, necklaces, paintings, poems? All extensions of the same mission.",
    },
    {
      heading: "Host events:",
      body: "Open mics, art exhibitions, candlelight vigils for causes that matter. Document stories travel, listen, and share the raw, real narratives of people who inspire us.",
    },
    {
      heading: "Collaborate:",
      body: "Not compete build a network where creators lift each other up. Break industry barriers no gatekeeping, no exclusivity. If you have talent, you deserve a spotlight. This is bigger than us. Imagine a platform where: A street artist from Lagos can showcase work alongside a designer from Tokyo. A poet from Chicago can collaborate with a musician from Berlin.\n\nA small-town jewelry maker gets the same exposure as a high-end brand. That's the world we're building. One where creativity isn't confined by borders, budgets, or barriers.\n\nSo if you've ever felt like your art was too \"different,\" too \"unknown,\" or just waiting for the right moment to be seen this is your sign.",
    },
  ],
  "Our Future": [
    {
      heading: "Our Future",
      body: "Beyond awareness and donating to charities. our main goal is to eventually grow into a platform where people who want to go out to these countries and give aid first hand can do. And on these trips, through film, and raw storytelling, we can capture the human experience.\n\nThe smiles, the struggles, the shared meals and shared lessons, the laughter from the late night fire-place conversations the laughter in unlikely places, the stories that remind us: no matter where we're from or who we are, we're all living the same story, on the same planet.\n\nVIVA LA VISION DE GARÇON",
    },
  ],
};

export default function AboutPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("What Is VDG");
  return (
    <main className="min-h-screen bg-white">
      <Header showCart={false} />
      <div className="mx-auto max-w-3xl px-4 pb-28">
        <div className="my-6 flex justify-center">
          <Image src="/about/IMG_6566.jpg" alt="WHAT IS VDG?" width={700} height={400} className="object-cover" />
        </div>
        <h1 className="text-center font-oswald text-2xl font-bold tracking-widest">WHAT IS VDG?</h1>
        <div className="mt-6 flex justify-center gap-6 text-sm">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-1 ${tab === t ? "border-black font-semibold" : "border-transparent text-gray-500"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-6">
          {SECTIONS[tab].map((s) => (
            <section key={s.heading}>
              <h2 className="font-semibold">{s.heading}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-14">
          {GALLERY.map((g) => (
            <figure key={g.title} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.img} alt={g.title} className="mx-auto max-h-[560px] w-auto" />
              <figcaption className="mx-auto mt-3 max-w-xl">
                <div className="font-semibold">{g.title}</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{g.body}</p>
                <div className="mt-1 text-xs text-gray-500">{g.credit}</div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="font-platypi tracking-widest">Rideaux</div>
          <Link href="/" className="mt-4 inline-block font-platypi text-sm underline">
            Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
