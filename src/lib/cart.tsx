"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type CartItem = {
  variantId: number;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  priceCents: number;
  image: string;
  qty: number;
  maxQty?: number; // stock available when added; qty is clamped to this
};

type CartCtx = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (variantId: number) => void;
  setQty: (variantId: number, qty: number) => void;
  clear: () => void;
  count: number;
  totalCents: number;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vdg-cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  const persist = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem("vdg-cart", JSON.stringify(next));
  };
  const clamp = (i: CartItem, qty: number) =>
    Math.min(Math.max(1, Math.floor(qty || 1)), i.maxQty ?? 10);
  const add = (item: CartItem) => {
    const existing = items.find((i) => i.variantId === item.variantId);
    persist(
      existing
        ? items.map((i) =>
            i.variantId === item.variantId ? { ...i, qty: clamp(i, i.qty + item.qty) } : i
          )
        : [...items, { ...item, qty: clamp(item, item.qty) }]
    );
  };
  const remove = (variantId: number) => persist(items.filter((i) => i.variantId !== variantId));
  const setQty = (variantId: number, qty: number) =>
    persist(items.map((i) => (i.variantId === variantId ? { ...i, qty: clamp(i, qty) } : i)));
  const clear = () => persist([]);
  const count = items.reduce((n, i) => n + i.qty, 0);
  const totalCents = items.reduce((n, i) => n + i.qty * i.priceCents, 0);
  return (
    <Ctx.Provider value={{ items, add, remove, setQty, clear, count, totalCents }}>{children}</Ctx.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart outside CartProvider");
  return ctx;
};
