"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { useCart } from "@/lib/cart";
import { fmtPrice } from "@/lib/supabase";

export default function CartPage() {
  const { items, remove, setQty, totalCents } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-2xl px-4 pb-28">
        <h1 className="font-oswald text-xl font-bold">Cart</h1>
        {items.length === 0 ? (
          <p className="mt-6 text-sm">
            Your cart is empty.{" "}
            <Link href="/store" className="underline">
              Keep shopping
            </Link>
          </p>
        ) : (
          <>
            <ul className="mt-6 flex flex-col gap-6">
              {items.map((i) => (
                <li key={i.variantId} className="flex items-center gap-4">
                  {i.image && (
                    <div className="relative h-20 w-16 shrink-0">
                      <Image src={i.image} alt="" fill className="object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Link href={`/products/${i.productHandle}`} className="text-sm font-semibold">
                      {i.productTitle}
                    </Link>
                    <div className="text-xs text-gray-600">{i.variantTitle}</div>
                    <div className="text-sm">{fmtPrice(i.priceCents)}</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={i.qty}
                    onChange={(e) => setQty(i.variantId, Number(e.target.value))}
                    className="w-14 border border-black px-2 py-1 text-sm"
                  />
                  <button onClick={() => remove(i.variantId)} className="text-xs underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex items-center justify-between border-t border-black pt-4">
              <span className="text-sm">Total</span>
              <span className="font-semibold">{fmtPrice(totalCents)} AUD</span>
            </div>
            {error && <p className="mt-3 text-sm text-[#a51b1b]">{error}</p>}
            <button
              onClick={checkout}
              disabled={loading}
              className="mt-4 w-full bg-black py-3 text-sm text-white disabled:opacity-60"
            >
              {loading ? "Redirecting…" : "Checkout"}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              Secure payment via Stripe · Free shipping Australia/France
            </p>
          </>
        )}
      </div>
    </main>
  );
}
