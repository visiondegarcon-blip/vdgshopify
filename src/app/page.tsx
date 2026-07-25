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
      <Image src="/site/hero.jpg" alt="" fill priority className="object-cover object-top" />
      <div className="relative z-10 flex flex-col items-center pt-[28vh]">
        <Image
          src="/site/BOY_PULLS_WRLD_WHT_GLOBE.png"
          alt="VDG"
          width={140}
          height={65}
          className="object-contain"
        />
        <div className="mt-3 text-black font-semibold tracking-[0.25em] text-sm">
          02/22/2023&nbsp;&nbsp;2:22PM
        </div>
        <nav className="mt-6 w-[132px] bg-black/40 text-center">
          {nav.map((n) =>
            n.external ? (
              <a
                key={n.label}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 text-white text-sm hover:bg-black/60"
              >
                {n.label}
              </a>
            ) : (
              <Link
                key={n.label}
                href={n.href}
                className="block py-2 text-white text-sm hover:bg-black/60"
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
