"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { useCart } from "@/lib/cart";
import { fmtPrice, supabase } from "@/lib/supabase";
import { sessionId, track } from "@/lib/track";
import { COUNTRY_NAMES } from "@/lib/countries";

type ShippingQuote = { service: "standard" | "express"; label: string; priceCents: number; totalWeightG: number };

export default function CartPage() {
  const { items, remove, setQty, totalCents } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLabel, setCheckoutLabel] = useState("Checkout");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; description: string } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [service, setService] = useState<"standard" | "express">("standard");
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const shipping = quotes.find((q) => q.service === service) ?? null;

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

  // Countries we actually ship to come from the admin's region table.
  useEffect(() => {
    fetch("/api/shipping-quote")
      .then((r) => r.json())
      .then((j) => {
        const list: string[] = j.countries ?? [];
        setCountries(list);
        const saved = typeof window !== "undefined" ? localStorage.getItem("vdg-ship-country") : null;
        if (saved && list.includes(saved)) setCountry(saved);
      })
      .catch(() => {});
  }, []);

  // Re-quote whenever the destination or the cart contents change.
  useEffect(() => {
    if (!country || !items.length) return setQuotes([]);
    localStorage.setItem("vdg-ship-country", country);
    setQuoting(true);
    setShipMsg(null);
    fetch("/api/shipping-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        setQuotes(j.quotes ?? []);
        if (j.error) setShipMsg(j.error);
      })
      .catch(() => setShipMsg("Couldn't load shipping rates."))
      .finally(() => setQuoting(false));
  }, [country, items]);

  const checkout = async () => {
    if (!country) return setError("Choose where we're shipping to first.");
    if (!shipping) return setError("No shipping option available for that destination.");
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
          country,
          shipping_service: service,
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
            <div className="mt-6 border-t border-black pt-4">
              <label className="block text-sm font-semibold">Shipping to</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-2 w-full border border-black px-3 py-2 font-mono text-sm"
              >
                <option value="">Select a country…</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {COUNTRY_NAMES[c] ?? c}
                  </option>
                ))}
              </select>

              {quoting && <p className="mt-2 text-xs text-gray-500">Calculating shipping…</p>}
              {shipMsg && <p className="mt-2 text-xs text-[#a51b1b]">{shipMsg}</p>}

              {!quoting && quotes.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {quotes.map((q) => (
                    <label
                      key={q.service}
                      className={`flex cursor-pointer items-center justify-between border px-3 py-2 text-sm ${
                        service === q.service ? "border-black" : "border-gray-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping-service"
                          checked={service === q.service}
                          onChange={() => setService(q.service)}
                        />
                        {q.label}
                      </span>
                      <span className="font-semibold">
                        {q.priceCents === 0 ? "Free" : fmtPrice(q.priceCents)}
                      </span>
                    </label>
                  ))}
                  <p className="text-[11px] text-gray-500">
                    Parcel weight {(quotes[0].totalWeightG / 1000).toFixed(2)}kg
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span>{fmtPrice(totalCents)}</span>
            </div>
            {shipping && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span>Shipping</span>
                <span>{shipping.priceCents === 0 ? "Free" : fmtPrice(shipping.priceCents)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-gray-300 pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-semibold">
                {fmtPrice(totalCents + (shipping?.priceCents ?? 0))} AUD
              </span>
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
              Secure payment via Stripe
            </p>
          </>
        )}
      </div>
    </main>
  );
}
