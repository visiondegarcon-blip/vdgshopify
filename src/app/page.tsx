import Image from "next/image";
import Link from "next/link";
import HeroBackground from "@/components/HeroBackground";
import { getSettings, jsonSetting } from "@/lib/theme";

export const revalidate = 60;

const NAV_DEFAULTS = {
  globe: "VDG Globe™‎",
  store: "Store‎",
  about: "About Us‎",
  impact: "Our Impact",
  work: "Work For VDG‎",
  policies: "Policies‎",
};

export default async function Home() {
  const settings = await getSettings();
  const home = jsonSetting<{
    navLabels: typeof NAV_DEFAULTS;
    hero_images: string[];
    hero_mobile: string;
    hero_rotate: boolean;
    hero_interval_s: number;
  }>(settings, "content_home", {
    navLabels: NAV_DEFAULTS,
    hero_images: [],
    hero_mobile: "/site/hero-mobile.jpg",
    hero_rotate: false,
    hero_interval_s: 8,
  });
  const labels = { ...NAV_DEFAULTS, ...home.navLabels };
  const nav = [
    { label: labels.globe, href: "https://globe.visiondegarcon.com", external: true },
    { label: labels.store, href: "/store" },
    { label: labels.about, href: "/about-us" },
    { label: labels.impact, href: "https://impact.visiondegarcon.fr/", external: true },
    { label: labels.work, href: "/work-for-vdg" },
    { label: labels.policies, href: "/policy" },
  ];
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <HeroBackground
        desktop={home.hero_images.filter(Boolean)}
        mobile={home.hero_mobile || "/site/hero-mobile.jpg"}
        rotate={home.hero_rotate}
        intervalS={home.hero_interval_s}
      />
      <div className="relative z-10 flex flex-col items-center pt-[27vh]">
        <Image
          src="/site/BOY_PULLS_WRLD_WHT_GLOBE.png"
          alt="VDG"
          width={140}
          height={65}
          className="object-contain"
        />
        <div className="mt-3 font-platypi text-xs tracking-[2px] text-white">
          02/22/2023&nbsp;&nbsp;&nbsp;2:22PM
        </div>
        <nav className="mt-2 w-[130px] text-center">
          {nav.map((n) =>
            n.external ? (
              <a
                key={n.label}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-black/30 py-2 font-mono text-sm text-[#dfdbdb] hover:bg-black/50"
              >
                {n.label}
              </a>
            ) : (
              <Link
                key={n.label}
                href={n.href}
                className="block bg-black/30 py-2 font-mono text-sm text-[#dfdbdb] hover:bg-black/50"
              >
                {n.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </main>
  );
}
