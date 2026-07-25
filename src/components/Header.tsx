"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";

/* Shared page header: black band (free-shipping banner + splatter-boy logo
   in white), fixed brand timestamp, cart + account links. */
export default function Header({
  logo = "/site/logo-white.png",
  showCart = true,
}: {
  logo?: string | null;
  showCart?: boolean;
}) {
  const { count } = useCart();
  return (
    <header className="w-full">
      <div className="bg-black text-white">
        <div className="flex h-[52px] items-center justify-center text-center text-xs tracking-[2px]">
          FREE SHIPPING AUSTRALIA/FRANCE
        </div>
        {logo && (
          <div className="flex justify-center pb-4 pt-4">
            <Link href="/">
              <Image
                src={logo}
                alt="Vision De Garçon"
                width={114}
                height={230}
                className="h-[230px] w-auto object-contain"
              />
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center pt-4 pb-2">
        <div className="text-xs tracking-[2px]">
          02/22/2023&nbsp;&nbsp;&nbsp;2:22PM
        </div>
        {showCart && (
          <div className="mt-2 flex items-center gap-4 text-sm font-bold">
            <Link href="/cart">
              Cart<span className="ml-0.5 bg-black px-1 text-white">{count}</span>
            </Link>
            <Link href="/account" className="text-xs font-normal text-gray-500 hover:text-black">
              Account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
