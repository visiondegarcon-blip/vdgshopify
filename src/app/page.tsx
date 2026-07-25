import Image from "next/image";
import Link from "next/link";

const nav = [
  { label: "VDG Globe™‎", href: "https://globe.visiondegarcon.com", external: true },
  { label: "Store‎", href: "/store" },
  { label: "About Us‎", href: "/about-us" },
  { label: "Our Impact", href: "https://impact.visiondegarcon.fr/", external: true },
  { label: "Work For VDG‎", href: "/work-for-vdg" },
  { label: "Policies‎", href: "/policy" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <Image
        src="/site/hero-desktop.png"
        alt=""
        fill
        priority
        className="hidden object-cover md:block"
      />
      <Image
        src="/site/hero-mobile.jpg"
        alt=""
        fill
        priority
        className="object-cover md:hidden"
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
