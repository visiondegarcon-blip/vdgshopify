"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { adminCall, fmt } from "./adminApi";

type Stats = {
  totalSalesCents: number;
  orderCount: number;
  unfulfilled: number;
  unitsInStock: number;
  orders: { created_at: string; total_cents: number; status: string }[];
};

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";

  useEffect(() => {
    adminCall<Stats>("stats").then(setStats).catch(() => {});
  }, []);

  const last30 = (stats?.orders ?? []).filter(
    (o) => o.status === "paid" && Date.now() - new Date(o.created_at).getTime() < 30 * 864e5
  );
  const sales30 = last30.reduce((n, o) => n + o.total_cents, 0);

  return (
    <div>
      {/* Metric strip */}
      <div className="flex items-center gap-8 text-xs text-gray-600">
        <span className="font-medium text-[#1a1a1a]">Last 30 days</span>
        <span>Total sales <span className="ml-1 font-semibold text-[#1a1a1a]">{fmt(sales30)}</span></span>
        <span>Orders <span className="ml-1 font-semibold text-[#1a1a1a]">{last30.length}</span></span>
        <span>To fulfill <span className="ml-1 font-semibold text-[#1a1a1a]">{stats?.unfulfilled ?? "–"}</span></span>
        <span>Units in stock <span className="ml-1 font-semibold text-[#1a1a1a]">{stats?.unitsInStock ?? "–"}</span></span>
      </div>

      <div className="mt-16 text-center">
        <h1 className="text-2xl font-semibold text-[#1a1a1a]">{greeting}</h1>
        <p className="mt-1 text-xl text-[#1a1a1a]">Let&apos;s continue growing the vision.</p>
        {stats && stats.unfulfilled > 0 && (
          <Link
            href="/admin/orders"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm hover:shadow"
          >
            Fulfill orders
            <span className="rounded-md bg-[#ebebeb] px-1.5 text-xs font-semibold">{stats.unfulfilled}</span>
          </Link>
        )}
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        <Link href="/admin/products" className="rounded-xl bg-white p-5 shadow-sm hover:shadow">
          <div className="text-sm font-semibold">Drop something new</div>
          <p className="mt-1 text-xs text-gray-600">
            Add a product, set price and stock, upload photos, flip it to Active when the drop goes live.
          </p>
        </Link>
        <Link href="/admin/orders" className="rounded-xl bg-white p-5 shadow-sm hover:shadow">
          <div className="text-sm font-semibold">Orders &amp; fulfilment</div>
          <p className="mt-1 text-xs text-gray-600">
            See who bought what, shipping addresses, and mark orders fulfilled once posted.
          </p>
        </Link>
        <Link href="/admin/analytics" className="rounded-xl bg-white p-5 shadow-sm hover:shadow">
          <div className="text-sm font-semibold">Analytics</div>
          <p className="mt-1 text-xs text-gray-600">
            Sales over time, average order value, and your best-selling pieces.
          </p>
        </Link>
      </div>
    </div>
  );
}
