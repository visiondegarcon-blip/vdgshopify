"use client";
import { useEffect, useState } from "react";
import { adminCall } from "../adminApi";

type Opt = {
  sessions: number;
  avgSessionMs: number | null;
  funnel: { sessions: number; carted: number; checkout: number; purchased: number };
  cartAbandonPct: number | null;
  checkoutAbandonPct: number | null;
  trending: { country: string; sessions: number; prev: number }[];
  cities: [string, number][];
  referrers: [string, number][];
  clickPaths: [string, number][];
  products: { title: string; views: number; sold: number; conversion: number | null }[];
  soldOutDemand: [string, number][];
  pairs: [string, number][];
  hourHeat: number[][];
  sizesClicked: { product: string; sizes: [string, number][] }[];
  sizesCarted: { product: string; sizes: [string, number][] }[];
  sizesSold: { product: string; sizes: [string, number][] }[];
  atcRates: { product: string; viewed: number; carted: number; rate: number }[];
  landing: [string, number][];
  exits: [string, number][];
  trafficHeat: number[][];
  devices: [string, number][];
  returningVisitors: number;
  newVisitors: number;
};

function SizeCard({ title, hint, rows }: { title: string; hint: string; rows: { product: string; sizes: [string, number][] }[] }) {
  return (
    <Card title={title} hint={hint}>
      <div className="flex flex-col gap-3">
        {rows.slice(0, 6).map((r) => (
          <div key={r.product}>
            <div className="truncate text-[12px] font-medium">{r.product}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {r.sizes.map(([size, n]) => (
                <span key={size} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px]">
                  {size} <span className="text-gray-500">×{n}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-400">No data in this range yet.</p>}
      </div>
    </Card>
  );
}

const RANGES = { "7d": 7, "30d": 30, "90d": 90, All: 3650 } as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Card({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function OptimizationPage() {
  const [range, setRange] = useState<keyof typeof RANGES>("All");
  const [d, setD] = useState<Opt | null>(null);

  useEffect(() => {
    setD(null);
    adminCall<Opt>("optimization", { days: RANGES[range] }).then(setD).catch(() => {});
  }, [range]);

  const mins = d?.avgSessionMs != null ? Math.floor(d.avgSessionMs / 60000) : null;
  const secs = d?.avgSessionMs != null ? Math.round((d.avgSessionMs % 60000) / 1000) : null;
  const maxHeat = d ? Math.max(1, ...d.hourHeat.flat()) : 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Optimization</h1>
        <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 ${range === r ? "bg-[#1a1a1a] text-white" : ""}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-gray-400">
        Order-based cards (sellers, pairs, order heatmap) include your full Shopify history.
        Visitor-based cards (sessions, funnel, journeys, geo) come from the new site&apos;s own
        tracking, which started 30 Jul 2026 — they fill up as traffic arrives.
      </p>

      {!d && <p className="mt-6 text-sm text-gray-500">Analysing…</p>}

      {d && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {(
              [
                ["Sessions", String(d.sessions)],
                ["Avg time on site", mins != null ? `${mins}m ${secs}s` : "—"],
                ["Cart abandonment", d.cartAbandonPct != null ? `${d.cartAbandonPct}%` : "—"],
                ["Checkout abandonment", d.checkoutAbandonPct != null ? `${d.checkoutAbandonPct}%` : "—"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-xs text-gray-600">{k}</div>
                <div className="mt-1 text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* funnel */}
          <Card title="Shopping funnel" hint="sessions → added to cart → started checkout → purchased">
            <div className="flex items-end gap-2">
              {(
                [
                  ["Visited", d.funnel.sessions],
                  ["Carted", d.funnel.carted],
                  ["Checkout", d.funnel.checkout],
                  ["Purchased", d.funnel.purchased],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex-1 text-center">
                  <div
                    className="mx-auto w-full rounded-t bg-[#1a1a1a]"
                    style={{ height: `${Math.max(6, (v / Math.max(d.funnel.sessions, 1)) * 90)}px`, opacity: 0.85 }}
                  />
                  <div className="mt-1 text-sm font-semibold">{v}</div>
                  <div className="text-[11px] text-gray-500">{k}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Products: views vs sales" hint="conversion = units sold / product page views">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <tr><th>Product</th><th className="text-right">Views</th><th className="text-right">Sold</th><th className="text-right">Conv.</th></tr>
                </thead>
                <tbody>
                  {d.products.slice(0, 8).map((p) => (
                    <tr key={p.title} className="border-t border-gray-100">
                      <td className="max-w-[220px] truncate py-1.5">{p.title}</td>
                      <td className="text-right">{p.views}</td>
                      <td className="text-right">{p.sold}</td>
                      <td className="text-right">{p.conversion != null && p.views >= p.sold ? `${Math.round(p.conversion * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                  {d.products.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No product data yet.</td></tr>}
                </tbody>
              </table>
            </Card>

            <Card title="Restock demand" hint="views on sold-out products — people wanting what you don't have">
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.soldOutDemand.map(([t, n]) => (
                  <li key={t} className="flex justify-between"><span className="truncate">{t}</span><span className="font-semibold">{n} views</span></li>
                ))}
                {d.soldOutDemand.length === 0 && <li className="text-gray-400">No sold-out product views in range.</li>}
              </ul>
            </Card>

            <Card title="Frequently bought together">
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.pairs.map(([p, n]) => (
                  <li key={p} className="flex justify-between"><span className="truncate">{p}</span><span className="text-gray-500">{n}×</span></li>
                ))}
                {d.pairs.length === 0 && <li className="text-gray-400">Needs multi-item orders to show pairs.</li>}
              </ul>
            </Card>

            <Card title="Where visitors come from" hint="first referrer per session">
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.referrers.map(([r, n]) => (
                  <li key={r} className="flex items-center gap-2">
                    <span className="w-24 shrink-0">{r}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                      <div className="h-full bg-[#1a1a1a]" style={{ width: `${(n / Math.max(d.sessions, 1)) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-500">{n}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Trending countries" hint="unique sessions vs previous period">
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.trending.map((t) => (
                  <li key={t.country} className="flex justify-between">
                    <span>{t.country}</span>
                    <span>
                      {t.sessions}
                      <span className={`ml-2 text-[11px] ${t.sessions >= t.prev ? "text-green-700" : "text-red-700"}`}>
                        {t.prev === 0 ? "new" : `${t.sessions >= t.prev ? "+" : ""}${t.sessions - t.prev}`}
                      </span>
                    </span>
                  </li>
                ))}
                {d.trending.length === 0 && <li className="text-gray-400">No geo data yet (populates on the live site).</li>}
              </ul>
            </Card>

            <Card title="Trending cities">
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.cities.map(([c, n]) => (
                  <li key={c} className="flex justify-between"><span>{c}</span><span className="text-gray-500">{n}</span></li>
                ))}
                {d.cities.length === 0 && <li className="text-gray-400">No city data yet.</li>}
              </ul>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <SizeCard title="Sizes sold" hint="units per size, from all orders incl. Shopify history" rows={d.sizesSold} />
            <SizeCard title="Sizes clicked" hint="size selections on product pages (new-site tracking)" rows={d.sizesClicked} />
            <SizeCard title="Sizes added to cart" hint="what people cart after clicking (new-site tracking)" rows={d.sizesCarted} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Add-to-cart rate" hint="sessions that carted a product / sessions that viewed it">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <tr><th>Product</th><th className="text-right">Viewed</th><th className="text-right">Carted</th><th className="text-right">Rate</th></tr>
                </thead>
                <tbody>
                  {d.atcRates.map((r) => (
                    <tr key={r.product} className="border-t border-gray-100">
                      <td className="max-w-[200px] truncate py-1.5">{r.product}</td>
                      <td className="text-right">{r.viewed}</td>
                      <td className="text-right">{r.carted}</td>
                      <td className="text-right font-semibold">{r.rate}%</td>
                    </tr>
                  ))}
                  {d.atcRates.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No product traffic yet.</td></tr>}
                </tbody>
              </table>
            </Card>

            <Card title="Visitors" hint="within this range vs the previous period">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[12px] text-gray-600">New visitors</div>
                  <div className="mt-1 text-2xl font-semibold">{d.newVisitors}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-600">Returning visitors</div>
                  <div className="mt-1 text-2xl font-semibold">{d.returningVisitors}</div>
                </div>
              </div>
              <div className="mt-4 text-[12px] font-semibold text-gray-600">Devices</div>
              <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
                {d.devices.map(([dev, n]) => (
                  <li key={dev} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 capitalize">{dev}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                      <div className="h-full bg-[#1a1a1a]" style={{ width: `${(n / Math.max(d.sessions, 1)) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-500">{n}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Top landing pages" hint="first page of each session">
              <ul className="flex flex-col gap-1.5 font-mono text-[12px]">
                {d.landing.map(([p, n]) => (
                  <li key={p} className="flex justify-between"><span className="truncate">{p}</span><span className="ml-3 text-gray-500">{n}</span></li>
                ))}
                {d.landing.length === 0 && <li className="text-gray-400">No sessions yet.</li>}
              </ul>
            </Card>

            <Card title="Top exit pages" hint="last page before leaving — where you lose people">
              <ul className="flex flex-col gap-1.5 font-mono text-[12px]">
                {d.exits.map(([p, n]) => (
                  <li key={p} className="flex justify-between"><span className="truncate">{p}</span><span className="ml-3 text-gray-500">{n}</span></li>
                ))}
                {d.exits.length === 0 && <li className="text-gray-400">No sessions yet.</li>}
              </ul>
            </Card>
          </div>

          <Card title="Traffic by hour (UTC)" hint="page views — rows are days, columns are hours">
            <div className="flex flex-col gap-[3px]">
              {d.trafficHeat.map((row, day) => {
                const maxT = Math.max(1, ...d.trafficHeat.flat());
                return (
                  <div key={day} className="flex items-center gap-[3px]">
                    <span className="w-8 text-[10px] text-gray-400">{DAYS[day]}</span>
                    {row.map((v, h) => (
                      <div
                        key={h}
                        title={`${DAYS[day]} ${h}:00 — ${v} views`}
                        className="h-4 flex-1 rounded-[2px]"
                        style={{ background: v ? `rgba(10,93,240,${0.15 + 0.85 * (v / maxT)})` : "#f3f4f6" }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>

          <a
            href="/admin/optimization/journeys"
            className="mt-4 flex items-center justify-between rounded-xl bg-[#1a1a1a] p-5 text-white shadow-sm transition hover:bg-black"
          >
            <div>
              <div className="text-sm font-semibold">Customer journeys</div>
              <div className="mt-0.5 text-[12px] text-white/60">
                See how visitors flow through your store, step by step — visualised
              </div>
            </div>
            <span className="text-xl">→</span>
          </a>

          <Card title="Orders by hour (UTC)" hint="rows are days, columns are hours — darker = more orders">
            <div className="flex flex-col gap-[3px]">
              {d.hourHeat.map((row, day) => (
                <div key={day} className="flex items-center gap-[3px]">
                  <span className="w-8 text-[10px] text-gray-400">{DAYS[day]}</span>
                  {row.map((v, h) => (
                    <div
                      key={h}
                      title={`${DAYS[day]} ${h}:00 — ${v} orders`}
                      className="h-4 flex-1 rounded-[2px]"
                      style={{ background: v ? `rgba(26,26,26,${0.15 + 0.85 * (v / maxHeat)})` : "#f3f4f6" }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
