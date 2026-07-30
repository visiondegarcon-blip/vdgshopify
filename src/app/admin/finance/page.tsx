"use client";
import { useEffect, useState } from "react";
import { adminCall, fmt } from "../adminApi";

type Overview = {
  gross: number; fees: number; net: number; refunds: number; chargeCount: number;
  payouts: { id: string; amount: number; arrival: number; status: string }[];
  txns: { ts: number; type: string; amount: number; fee: number; net: number; desc: string }[];
};
type Eofy = {
  fy: number; gross: number; discounts: number; fees: number; net: number;
  auGross: number; gstEstimate: number; orderCount: number;
  monthly: Record<string, { gross: number; orders: number }>;
};

const RANGES = { "30d": 30, "90d": 90, "12m": 365, All: 3650 } as const;

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FinancePage() {
  const [tab, setTab] = useState<"overview" | "eofy">("overview");
  const [range, setRange] = useState<keyof typeof RANGES>("90d");
  const [data, setData] = useState<Overview | null>(null);
  const [fy, setFy] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  });
  const [eofy, setEofy] = useState<Eofy | null>(null);

  useEffect(() => {
    setData(null);
    adminCall<Overview>("finance_overview", { days: RANGES[range] }).then(setData).catch(() => {});
  }, [range]);

  useEffect(() => {
    if (tab !== "eofy") return;
    setEofy(null);
    adminCall<Eofy>("finance_eofy", { fy }).then(setEofy).catch(() => {});
  }, [tab, fy]);

  const exportOrders = async () => {
    const r = await adminCall<{ csv: string }>("export_orders_csv");
    download("vdg-orders.csv", r.csv);
  };

  const exportTxns = () => {
    if (!data) return;
    const lines = ["date,type,amount_aud,fee_aud,net_aud,description"];
    for (const t of data.txns)
      lines.push(
        `${new Date(t.ts * 1000).toISOString()},${t.type},${(t.amount / 100).toFixed(2)},${(t.fee / 100).toFixed(2)},${(t.net / 100).toFixed(2)},"${t.desc.replace(/"/g, '""')}"`
      );
    download("vdg-stripe-transactions.csv", lines.join("\n"));
  };

  const exportEofyCsv = () => {
    if (!eofy) return;
    const lines = [
      `VDG EOFY summary FY${eofy.fy - 1}-${String(eofy.fy).slice(2)}`,
      "",
      "metric,amount_aud",
      `gross_sales,${(eofy.gross / 100).toFixed(2)}`,
      `discounts_given,${(eofy.discounts / 100).toFixed(2)}`,
      `processing_fees,${(eofy.fees / 100).toFixed(2)}`,
      `net_income,${(eofy.net / 100).toFixed(2)}`,
      `australian_sales,${(eofy.auGross / 100).toFixed(2)}`,
      `gst_estimate_1_11th,${(eofy.gstEstimate / 100).toFixed(2)}`,
      `orders,${eofy.orderCount}`,
      "",
      "month,gross_aud,orders",
      ...Object.entries(eofy.monthly)
        .sort()
        .map(([m, v]) => `${m},${(v.gross / 100).toFixed(2)},${v.orders}`),
    ];
    download(`vdg-eofy-fy${eofy.fy}.csv`, lines.join("\n"));
  };

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Finance</h1>
          <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
            <button onClick={() => setTab("overview")} className={`rounded-md px-2.5 py-1 ${tab === "overview" ? "bg-[#1a1a1a] text-white" : ""}`}>
              Overview
            </button>
            <button onClick={() => setTab("eofy")} className={`rounded-md px-2.5 py-1 ${tab === "eofy" ? "bg-[#1a1a1a] text-white" : ""}`}>
              EOFY
            </button>
          </div>
        </div>
        {tab === "overview" && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
              {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 ${range === r ? "bg-[#1a1a1a] text-white" : ""}`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={exportOrders} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">
              Export orders CSV
            </button>
            <button onClick={exportTxns} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">
              Export transactions CSV
            </button>
          </div>
        )}
      </div>

      {tab === "overview" && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {data
              ? (
                  [
                    ["Gross (charges)", fmt(data.gross)],
                    ["Stripe fees", fmt(data.fees)],
                    ["Net", fmt(data.net)],
                    ["Refunds", fmt(data.refunds)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="text-xs text-gray-600">{k}</div>
                    <div className="mt-1 text-lg font-semibold">{v}</div>
                  </div>
                ))
              : "Loading…"}
          </div>

          <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Payouts to your bank</div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr><th className="py-1.5">Arrives</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data?.payouts.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-1.5">{new Date(p.arrival * 1000).toLocaleDateString()}</td>
                    <td>{fmt(p.amount)}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
                {data && data.payouts.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center text-gray-500">No payouts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Recent transactions</div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr><th className="py-1.5">Date</th><th>Type</th><th>Amount</th><th>Fee</th><th>Net</th></tr>
              </thead>
              <tbody>
                {data?.txns.slice(0, 20).map((t, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5">{new Date(t.ts * 1000).toLocaleDateString()}</td>
                    <td>{t.type}</td>
                    <td>{fmt(t.amount)}</td>
                    <td>{fmt(t.fee)}</td>
                    <td>{fmt(t.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "eofy" && (
        <div className="mt-4">
          <div className="flex items-center gap-3 print:hidden">
            <label className="text-sm">
              Financial year:&nbsp;
              <select
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                {[0, 1, 2, 3].map((back) => {
                  const now = new Date();
                  const current = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
                  const y = current - back;
                  return (
                    <option key={y} value={y}>
                      FY {y - 1}–{String(y).slice(2)} (Jul {y - 1} – Jun {y})
                    </option>
                  );
                })}
              </select>
            </label>
            <button onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">
              Print / Save as PDF
            </button>
            <button onClick={exportEofyCsv} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs">
              Download CSV
            </button>
          </div>

          {eofy && (
            <div className="mt-4 rounded-xl bg-white p-8 shadow-sm print:shadow-none">
              <div className="text-lg font-bold">Vision De Garçon — EOFY Financial Summary</div>
              <div className="text-sm text-gray-500">
                Financial year 1 July {eofy.fy - 1} – 30 June {eofy.fy} · Generated {new Date().toLocaleDateString()}
              </div>
              <table className="mt-6 w-full max-w-md text-sm">
                <tbody>
                  {(
                    [
                      ["Gross sales", fmt(eofy.gross)],
                      ["Discounts given", `− ${fmt(eofy.discounts)}`],
                      ["Payment processing fees (Stripe)", `− ${fmt(eofy.fees)}`],
                      ["Net income", fmt(eofy.net)],
                      ["— of which Australian sales", fmt(eofy.auGross)],
                      ["GST collected estimate (1/11 of AU sales)", fmt(eofy.gstEstimate)],
                      ["Orders", String(eofy.orderCount)],
                    ] as const
                  ).map(([k, v]) => (
                    <tr key={k} className="border-b border-gray-100">
                      <td className="py-2 text-gray-600">{k}</td>
                      <td className="py-2 text-right font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-8 text-sm font-semibold">Monthly breakdown</div>
              <table className="mt-2 w-full max-w-md text-sm">
                <thead className="text-xs text-gray-500">
                  <tr><th className="py-1 text-left">Month</th><th className="text-right">Gross</th><th className="text-right">Orders</th></tr>
                </thead>
                <tbody>
                  {Object.entries(eofy.monthly).sort().map(([m, v]) => (
                    <tr key={m} className="border-t border-gray-100">
                      <td className="py-1.5">{m}</td>
                      <td className="text-right">{fmt(v.gross)}</td>
                      <td className="text-right">{v.orders}</td>
                    </tr>
                  ))}
                  {Object.keys(eofy.monthly).length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-gray-500">No paid orders in this financial year.</td></tr>
                  )}
                </tbody>
              </table>

              <p className="mt-8 max-w-lg text-[11px] leading-relaxed text-gray-400">
                Prepared from your store&apos;s order records and Stripe transaction data as an ATO-ready
                summary. This is not tax advice — confirm figures (especially GST, which assumes
                GST-registered status and GST-inclusive AU pricing) with your accountant before lodging.
              </p>
            </div>
          )}
          {!eofy && <p className="mt-6 text-sm text-gray-500">Crunching the numbers…</p>}
        </div>
      )}
    </div>
  );
}
