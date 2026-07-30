"use client";
import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useCart } from "@/lib/cart";

export default function SuccessPage() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="t-surface min-h-screen">
      <Header />
      <div className="mx-auto max-w-xl px-4 pb-28 text-center">
        <h1 className="font-oswald text-2xl font-bold">Merci! Order Confirmed ✓</h1>
        <p className="mt-4 text-sm leading-relaxed">
          Thank you for supporting the vision. A receipt has been emailed to you.
          <br />A portion of profits goes towards charities directly helping Congo.
        </p>
        <Link href="/store" className="t-btn mt-8 inline-block px-6 py-3 text-sm">
          Keep Shopping
        </Link>
      </div>
    </main>
  );
}
