import type { Metadata } from "next";
import { Inconsolata, Platypi, Oswald } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import MusicPlayer from "@/components/MusicPlayer";

const inconsolata = Inconsolata({ subsets: ["latin"], variable: "--font-inconsolata" });
const platypi = Platypi({ subsets: ["latin"], variable: "--font-platypi" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });

export const metadata: Metadata = {
  title: "Vision De Garçon | No Congo No Tesla",
  description:
    "Vision De Garçon (VDG) — a humanitarian platform and clothing brand. A voice for the unspoken.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inconsolata.variable} ${platypi.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          {children}
          <MusicPlayer />
        </CartProvider>
      </body>
    </html>
  );
}
