import type { Metadata } from "next";
import { Inconsolata, Platypi, Oswald, Gochi_Hand, Orbitron } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import MusicPlayer from "@/components/MusicPlayer";
import Tracker from "@/components/Tracker";
import ThemePreview from "@/components/ThemePreview";
import ScrollPopup from "@/components/ScrollPopup";
import { applyContentOverrides, getActiveTheme, getSettings, themeStyle } from "@/lib/theme";

const inconsolata = Inconsolata({ subsets: ["latin"], variable: "--font-inconsolata" });
const platypi = Platypi({ subsets: ["latin"], variable: "--font-platypi" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
const gochi = Gochi_Hand({ weight: "400", subsets: ["latin"], variable: "--font-gochi" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: "Vision De Garçon | No Congo No Tesla",
  description:
    "Vision De Garçon (VDG) — a humanitarian platform and clothing brand. A voice for the unspoken.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [baseTheme, settings] = await Promise.all([getActiveTheme(), getSettings()]);
  const { tokens: theme, extraVars } = applyContentOverrides(baseTheme, settings);
  return (
    <html
      lang="en"
      className={`${inconsolata.variable} ${platypi.variable} ${oswald.variable} ${gochi.variable} ${orbitron.variable} h-full antialiased`}
      style={{ ...themeStyle(theme), ...extraVars } as React.CSSProperties}
    >
      <body className={`min-h-full flex flex-col vdg-texture-${theme.texture}`}>
        <CartProvider>
          {children}
          <MusicPlayer />
          <Tracker />
          <ThemePreview />
          <ScrollPopup />
        </CartProvider>
      </body>
    </html>
  );
}
