import type { Metadata } from "next";
import { Inconsolata, Platypi, Oswald, Gochi_Hand, Orbitron } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import MusicPlayer from "@/components/MusicPlayer";
import Tracker from "@/components/Tracker";
import ThemePreview from "@/components/ThemePreview";
import ScrollPopup from "@/components/ScrollPopup";
import { applyContentOverrides, getActiveTheme, getSettings, themeStyle } from "@/lib/theme";
import { headers } from "next/headers";
import LockScreen from "@/components/LockScreen";
import { getActiveLock } from "@/lib/lock";

/* Paths a site-wide lock must never cover: the admin and its login, the
   post-purchase receipt (they've already paid), and unsubscribe (a legal
   obligation that can't be gated behind a drop). */
const LOCK_EXEMPT = ["/admin", "/account", "/success", "/unsubscribe"];

const inconsolata = Inconsolata({ subsets: ["latin"], variable: "--font-inconsolata" });
const platypi = Platypi({ subsets: ["latin"], variable: "--font-platypi" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const gochi = Gochi_Hand({ weight: "400", subsets: ["latin"], variable: "--font-gochi" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron" });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const favicon = settings.favicon_url;
  return {
    title: "Vision De Garçon | No Congo No Tesla",
    description:
      "Vision De Garçon (VDG) — a humanitarian platform and clothing brand. A voice for the unspoken.",
    icons: favicon ? { icon: favicon } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [baseTheme, settings, h] = await Promise.all([getActiveTheme(), getSettings(), headers()]);
  const { tokens: theme, extraVars } = applyContentOverrides(baseTheme, settings);

  const pathname = h.get("x-pathname") ?? "";
  const unlock = new URLSearchParams(h.get("x-search") ?? "").get("unlock") ?? undefined;
  const exempt = LOCK_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // "site" scope only — a store-scoped lock is applied by the store and
  // product pages themselves, so the rest of the site stays browsable.
  const siteLock = exempt ? null : await getActiveLock({ unlock }, "site");
  return (
    <html
      lang="en"
      className={`${inconsolata.variable} ${platypi.variable} ${oswald.variable} ${gochi.variable} ${orbitron.variable} h-full antialiased`}
      style={{ ...themeStyle(theme), ...extraVars } as React.CSSProperties}
    >
      <body className={`min-h-full flex flex-col vdg-texture-${theme.texture}`}>
        {siteLock ? (
          <LockScreen config={siteLock} />
        ) : (
          <CartProvider>
            {children}
            <MusicPlayer />
            <Tracker />
            <ThemePreview />
            <ScrollPopup />
          </CartProvider>
        )}
      </body>
    </html>
  );
}
