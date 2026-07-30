"use client";
import { useEffect, useMemo, useState } from "react";
import { adminCall, fmt } from "../adminApi";
import LiveView from "./LiveView";

type Order = {
  id: number; total_cents: number; status: string; created_at: string; email: string;
  order_items: { product_title: string; variant_title: string; quantity: number; unit_price_cents: number }[];
};

const RANGES = { "7d": 7, "30d": 30, "90d": 90, All: 3650 } as const;

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [range, setRange] = useState<keyof typeof RANGES>("All");
  const [tab, setTab] = useState<"overview" | "live">("overview");

  useEffect(() => {
    adminCall<{ orders: Order[] }>("list_orders").then((r) => setOrders(r.orders));
  }, []);

  const data = useMemo(() => {
    const days = RANGES[range];
    const cutoff = Date.now() - days * 864e5;
    const paid = orders.filter((o) => o.status === "paid" && new Date(o.created_at).getTime() >= cutoff);
    const gross = paid.reduce((n, o) => n + o.total_cents, 0);
    const aov = paid.length ? gross / paid.length : 0;
    const returning = new Map<string, number>();
    for (const o of paid) returning.set(o.email, (returning.get(o.email) ?? 0) + 1);
    const returningRate = paid.length
      ? [...returning.values()].filter((n) => n > 1).length / returning.size
      : 0;

    // chart buckets: daily up to 90d, monthly beyond (so history shows on All)
    const monthly = days > 90;
    const buckets = new Map<string, number>();
    if (monthly) {
      const first = paid.length
        ? paid.reduce((min, o) => (o.created_at < min ? o.created_at : min), paid[0].created_at)
        : new Date().toISOString();
      const start = new Date(first.slice(0, 7) + "-01T00:00:00Z");
      const now = new Date();
      for (let d = new Date(start); d <= now; d.setUTCMonth(d.getUTCMonth() + 1)) {
        buckets.set(d.toISOString().slice(0, 7), 0);
      }
      for (const o of paid) {
        const k = o.created_at.slice(0, 7);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + o.total_cents);
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      for (const o of paid) {
        const k = o.created_at.slice(0, 10);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + o.total_cents);
      }
    }

    // best sellers
    const sellers = new Map<string, { qty: number; cents: number }>();
    for (const o of paid)
      for (const i of o.order_items) {
        const cur = sellers.get(i.product_title) ?? { qty: 0, cents: 0 };
        cur.qty += i.quantity; cur.cents += i.quantity * i.unit_price_cents;
        sellers.set(i.product_title, cur);
      }

    return {
      gross, aov, count: paid.length, returningRate,
      series: [...buckets.entries()],
      sellers: [...sellers.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 8),
    };
  }, [orders, range]);

  const max = Math.max(...data.series.map(([, v]) => v), 1);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Analytics</h1>
          <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
            <button onClick={() => setTab("overview")} className={`rounded-md px-2.5 py-1 ${tab === "overview" ? "bg-[#1a1a1a] text-white" : ""}`}>
              Overview
            </button>
            <button onClick={() => setTab("live")} className={`rounded-md px-2.5 py-1 ${tab === "live" ? "bg-[#1a1a1a] text-white" : ""}`}>
              ● Live view
            </button>
          </div>
        </div>
        {tab === "overview" && (
          <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 ${range === r ? "bg-[#1a1a1a] text-white" : ""}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "live" && (
        <div className="mt-4">
          <LiveView />
        </div>
      )}

      {tab === "overview" && (
      <>


      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {[
          ["Gross sales", fmt(data.gross)],
          ["Orders", String(data.count)],
          ["Average order value", fmt(Math.round(data.aov))],
          ["Returning customer rate", `${Math.round(data.returningRate * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-600 underline decoration-dotted">{k}</div>
            <div className="mt-1 text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold">Total sales over time</div>
        <div className="mt-4 flex h-40 items-end gap-[2px]">
          {data.series.map(([day, cents]) => (
            <div key={day} className="group relative flex-1">
              <div
                className="w-full rounded-t-sm bg-[#0a5df0]/80 transition-colors group-hover:bg-[#0a5df0]"
                style={{ height: `${(cents / max) * 100}%`, minHeight: cents > 0 ? 3 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {day}: {fmt(cents)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-500">
          <span>{data.series[0]?.[0]}</span>
          <span>{data.series[data.series.length - 1]?.[0]}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold">Top products</div>
        {data.sellers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No sales in this range.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-gray-600">
              <tr><th className="py-1.5">Product</th><th className="py-1.5">Units</th><th className="py-1.5">Sales</th></tr>
            </thead>
            <tbody>
              {data.sellers.map(([title, s]) => (
                <tr key={title} className="border-t border-gray-100">
                  <td className="py-1.5">{title}</td>
                  <td className="py-1.5">{s.qty}</td>
                  <td className="py-1.5">{fmt(s.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Sales data comes from real orders in your database; traffic data is first-party (no cookies).
      </p>
      </>
      )}
    </div>
  );
}
