"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";

/* Shared page header used on store/product/content pages:
   free-shipping banner, centered logo, fixed timestamp, cart link. */
export default function Header({
  logo = "/site/logo-black.png",
  showCart = true,
}: {
  logo?: string;
  showCart?: boolean;
}) {
  const { count } = useCart();
  return (
    <header className="w-full">
      <div className="bg-black text-white text-center py-2 text-sm tracking-[0.2em] font-platypi">
        FREE SHIPPING AUSTRALIA/FRANCE
      </div>
      <div className="flex flex-col items-center pt-6 pb-2">
        <Link href="/">
          <Image src={logo} alt="Vision De Garçon" width={110} height={100} className="object-contain" />
        </Link>
        <div className="mt-3 tracking-[0.25em] text-sm">
          02/22/2023&nbsp;&nbsp;2:22PM
        </div>
        {showCart && (
          <div className="mt-2 flex items-center gap-4 text-sm tracking-widest">
            <Link href="/cart">
              Cart&nbsp;<span className="bg-black text-white px-1">{count}</span>
            </Link>
            <Link href="/account" className="text-xs text-gray-600 hover:text-black">
              Account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
