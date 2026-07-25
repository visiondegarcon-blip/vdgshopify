"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";

/* Shared page header: free-shipping banner, splatter-boy logo (as on the
   original's inner pages), fixed brand timestamp, cart + account links. */
export default function Header({
  logo = "/site/logo-black.png",
  showCart = true,
  dark = false,
}: {
  logo?: string | null;
  showCart?: boolean;
  /* Extends the black banner through the logo + timestamp row, with the
     white logo variant. Used on pages that want a fuller black top block
     (currently just About Us). */
  dark?: boolean;
}) {
  const { count } = useCart();
  return (
    <header className="w-full">
      <div className={dark ? "bg-black text-white" : ""}>
        <div className="flex h-[52px] items-center justify-center bg-black text-center text-xs tracking-[2px] text-white">
          FREE SHIPPING AUSTRALIA/FRANCE
        </div>
        <div className="flex flex-col items-center pt-4 pb-2">
          {logo && (
            <Link href="/">
              <Image
                src={logo}
                alt="Vision De Garçon"
                width={114}
                height={230}
                className="h-[230px] w-auto object-contain"
              />
            </Link>
          )}
          <div className="mt-2 text-xs tracking-[2px]">
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
      </div>
    </header>
  );
}
