"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminCall, fmt } from "../../adminApi";

/* Stock across every size in one table, next to how many of each have
   actually sold. Stock itself is already maintained automatically — the
   Stripe webhook decrements it on each paid order — so this is about seeing
   and correcting it, not about entering it by hand every time. */

type Row = {
  id: number;
  productId: number;
  product: string;
  handle: string;
  status: string;
  variant: string;
  stock: number;
  priceCents: number;
  sold: number;
  waiting: number;
};

type Filter = "all" | "low" | "out" | "waiting";

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(
    () =>
      adminCall<{ rows: Row[]; threshold: number }>("inventory")
        .then((r) => {
          setRows(r.rows);
          setThreshold(r.threshold);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Could not load inventory"))
        .finally(() => setLoading(false)),
    []
  );
  useEffect(() => { load(); }, [load]);

  const setStock = async (row: Row, next: number) => {
    if (next === row.stock || Number.isNaN(next)) return;
    setErr(null);
    setNote(null);
    setBusy(row.id);
    try {
      const r = await adminCall<{ restocked?: { sent: number } }>("update_variant", {
        id: row.id,
        fields: { stock: Math.max(0, Math.floor(next)) },
      });
      await load();
      if (r.restocked?.sent) {
        setNote(`${row.product} (${row.variant}) restocked — emailed ${r.restocked.sent} waiting.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update stock.");
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filter === "low") return r.stock > 0 && r.stock <= threshold;
        if (filter === "out") return r.stock === 0;
        if (filter === "waiting") return r.waiting > 0;
        return true;
      })
      .filter((r) => !needle || `${r.product} ${r.variant}`.toLowerCase().includes(needle))
      .sort((a, b) => a.product.localeCompare(b.product) || a.variant.localeCompare(b.variant));
  }, [rows, filter, threshold, q]);

  const totals = useMemo(
    () => ({
      units: rows.reduce((n, r) => n + r.stock, 0),
      value: rows.reduce((n, r) => n + r.stock * r.priceCents, 0),
      out: rows.filter((r) => r.stock === 0).length,
      low: rows.filter((r) => r.stock > 0 && r.stock <= threshold).length,
      waiting: rows.reduce((n, r) => n + r.waiting, 0),
    }),
    [rows, threshold]
  );

  const FILTERS: [Filter, string, number][] = [
    ["all", "All", rows.length],
    ["low", "Low", totals.low],
    ["out", "Sold out", totals.out],
    ["waiting", "Has waitlist", rows.filter((r) => r.waiting > 0).length],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Stock drops automatically as orders come in. Edit a number here to correct or restock it.
          </p>
        </div>
        <Link href="/admin/products" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">
          Products
        </Link>
      </div>

      {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{err}</div>}
      {note && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{note}</div>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Units in stock", String(totals.units)],
            ["Stock value", fmt(totals.value)],
            [`Low (≤${threshold})`, String(totals.low)],
            ["Sold out", String(totals.out)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-[12px] text-gray-600">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-0.5 text-xs">
          {FILTERS.map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1 ${filter === key ? "bg-[#1a1a1a] text-white" : ""}`}
            >
              {label} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a product or size…"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5">In stock</th>
              <th className="px-4 py-2.5">Sold</th>
              <th className="px-4 py-2.5">Waiting</th>
              <th className="px-4 py-2.5">Value</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nothing matches that.</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/products/${r.productId}`} className="hover:underline">
                    {r.product}
                  </Link>
                  {r.status !== "active" && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                      {r.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">{r.variant}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.stock}
                      disabled={busy === r.id}
                      onBlur={(e) => setStock(r, Number(e.target.value))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                    />
                    {r.stock === 0 ? (
                      <span className="rounded-full bg-[#ffd6a4] px-2 py-0.5 text-[11px]">sold out</span>
                    ) : r.stock <= threshold ? (
                      <span className="rounded-full bg-[#fff0b3] px-2 py-0.5 text-[11px]">low</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-600">{r.sold}</td>
                <td className="px-4 py-2.5">
                  {r.waiting > 0 ? (
                    <span className="rounded-full bg-[#e6e0ff] px-2 py-0.5 text-[11px]">
                      {r.waiting} waiting
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-gray-600">{fmt(r.stock * r.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Raising a sold-out size from 0 emails everyone on its waitlist straight away.
      </p>
    </div>
  );
}
