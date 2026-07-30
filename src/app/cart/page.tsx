"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { useCart } from "@/lib/cart";
import { fmtPrice, supabase } from "@/lib/supabase";
import { sessionId, track } from "@/lib/track";

export default function CartPage() {
  const { items, remove, setQty, totalCents } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLabel, setCheckoutLabel] = useState("Checkout");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; description: string } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  const applyCode = async () => {
    setCodeMsg(null);
    setApplied(null);
    if (!code.trim()) return;
    const res = await fetch("/api/validate-discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotalCents: totalCents, sid: sessionId() }),
    });
    const j = await res.json();
    if (!res.ok) return setCodeMsg(j.error ?? "That code isn't valid.");
    setApplied({ code: j.code, description: j.description });
  };

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "content_buttons")
      .maybeSingle()
      .then(({ data }) => {
        try {
          const c = JSON.parse(data?.value ?? "{}");
          if (c.checkout) setCheckoutLabel(c.checkout);
        } catch {}
      });
  }, []);

  const checkout = async () => {
    setLoading(true);
    setError(null);
    track("checkout_started", { items: items.length, totalCents });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
          sid: sessionId(),
          discount_code: applied?.code ?? "",
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
    <main className="t-surface min-h-screen">
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
                      <Image src={i.image} alt="" fill sizes="64px" className="object-contain" />
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
                    max={i.maxQty ?? 10}
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
            <div className="mt-6 flex gap-2 border-t border-black pt-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Discount code"
                className="w-full border border-black px-3 py-2 font-mono text-sm uppercase"
              />
              <button onClick={applyCode} className="t-btn shrink-0 px-4 py-2 text-sm">
                Apply
              </button>
            </div>
            {codeMsg && <p className="mt-2 text-xs text-[#a51b1b]">{codeMsg}</p>}
            {applied && (
              <p className="mt-2 flex items-center justify-between text-xs">
                <span>
                  ✓ <span className="font-mono font-bold">{applied.code}</span> — {applied.description}, applied at checkout
                </span>
                <button onClick={() => { setApplied(null); setCode(""); }} className="underline">
                  Remove
                </button>
              </p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm">Total</span>
              <span className="font-semibold">{fmtPrice(totalCents)} AUD</span>
            </div>
            {error && <p className="mt-3 text-sm text-[#a51b1b]">{error}</p>}
            <button
              onClick={checkout}
              disabled={loading}
              className="t-btn mt-4 w-full py-3 text-sm disabled:opacity-60"
            >
              {loading ? "Redirecting…" : checkoutLabel}
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
