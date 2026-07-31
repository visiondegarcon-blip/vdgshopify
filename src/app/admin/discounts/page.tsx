"use client";
import { useEffect, useState } from "react";
import { adminCall, fmt } from "../adminApi";

type Discount = {
  id: number;
  code: string;
  kind: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
  times_redeemed: number;
  uses: number;
  restrictions: { min_order_cents?: number; first_order_only?: boolean; one_per_customer?: boolean } | null;
  created_at: string;
};

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "amount" | "free_shipping">("percent");
  const [value, setValue] = useState("10");
  const [maxRed, setMaxRed] = useState("");
  const [expires, setExpires] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [firstOnly, setFirstOnly] = useState(false);
  const [onePer, setOnePer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () =>
    adminCall<{ discounts: Discount[] }>("list_discounts").then((r) => setDiscounts(r.discounts));
  useEffect(() => {
    refresh();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminCall("create_discount", {
        code,
        kind,
        value:
          kind === "free_shipping" ? undefined
          : kind === "amount" ? Math.round(parseFloat(value) * 100)
          : parseFloat(value),
        maxRedemptions: maxRed ? parseInt(maxRed) : undefined,
        expiresAt: expires ? new Date(expires).toISOString() : undefined,
        restrictions: {
          min_order_cents: minOrder ? Math.round(parseFloat(minOrder) * 100) : 0,
          first_order_only: firstOnly,
          one_per_customer: onePer,
        },
      });
      setShowForm(false);
      setCode("");
      setValue("10");
      setMaxRed("");
      setExpires("");
      setMinOrder("");
      setFirstOnly(false);
      setOnePer(false);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Discounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white"
        >
          Create discount
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="mt-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[12px]">
              Code (what customers type at checkout)
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="VISION10"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 font-mono text-sm"
              />
            </label>
            <div className="flex items-end gap-2">
              <label className="text-[12px]">
                Type
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                  className="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="percent">% off</option>
                  <option value="amount">A$ off</option>
                  <option value="free_shipping">Free shipping (price unchanged)</option>
                </select>
              </label>
              {kind !== "free_shipping" && (
                <label className="flex-1 text-[12px]">
                  Value
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </label>
              )}
            </div>
            <label className="text-[12px]">
              Max uses (blank = unlimited)
              <input
                type="number"
                min="1"
                value={maxRed}
                onChange={(e) => setMaxRed(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-[12px]">
              Expires (blank = never)
              <input
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="text-[12px]">
              Minimum order A$ (blank = none)
              <input
                type="number"
                min="0"
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
            <div className="flex flex-col justify-end gap-1.5 pb-1 text-[12px]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
                First order only
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} />
                One use per customer
              </label>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Customers enter codes in the cart. &quot;First order&quot; and &quot;one per customer&quot; are
            tracked per browser (cookie) plus email at payment — strong deterrents, not unbreakable.
          </p>
          {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
          <button
            disabled={busy}
            className="mt-4 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      <div className="mt-5 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[12px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Discount</th>
              <th className="px-4 py-2.5">Used</th>
              <th className="px-4 py-2.5">Limits</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {discounts?.map((d) => (
              <tr key={d.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 font-mono font-semibold">{d.code}</td>
                <td className="px-4 py-2.5">
                  {d.kind === "free_shipping"
                    ? "Free shipping"
                    : d.percent_off
                      ? `${d.percent_off}% off`
                      : fmt(d.amount_off_cents ?? 0) + " off"}
                </td>
                <td className="px-4 py-2.5">{Math.max(d.times_redeemed ?? 0, d.uses ?? 0)}×</td>
                <td className="px-4 py-2.5 text-[12px] text-gray-500">
                  {d.max_redemptions ? `max ${d.max_redemptions}` : "unlimited"}
                  {d.expires_at ? ` · until ${new Date(d.expires_at).toLocaleDateString()}` : ""}
                  {d.restrictions?.min_order_cents ? ` · min ${fmt(d.restrictions.min_order_cents)}` : ""}
                  {d.restrictions?.first_order_only ? " · first order" : ""}
                  {d.restrictions?.one_per_customer ? " · 1/customer" : ""}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                      d.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {d.active ? "Active" : "Off"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={async () => {
                      await adminCall("toggle_discount", { id: d.id, active: !d.active });
                      refresh();
                    }}
                    className="text-xs underline"
                  >
                    {d.active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete discount code ${d.code}? This can't be undone.`)) return;
                      await adminCall("delete_discount", { id: d.id });
                      refresh();
                    }}
                    className="ml-3 text-xs text-red-600 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {discounts && discounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No discount codes yet. Create one and customers can apply it at Stripe checkout.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
