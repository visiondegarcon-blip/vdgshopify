"use client";
import { Fragment, useEffect, useState } from "react";
import { adminCall, fmt } from "../adminApi";

type Order = {
  id: number;
  email: string;
  total_cents: number;
  currency: string;
  status: string;
  fulfillment_status: string;
  refunded_cents?: number;
  tracking_number?: string | null;
  source?: string;
  stripe_session_id?: string;
  shipping_name: string | null;
  shipping_address: Record<string, string | null> | null;
  created_at: string;
  order_items: { product_title: string; variant_title: string; quantity: number; unit_price_cents: number }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shipFor, setShipFor] = useState<Order | null>(null);
  const [tracking, setTracking] = useState("");

  const load = () =>
    adminCall<{ orders: Order[] }>("list_orders")
      .then((r) => setOrders(r.orders))
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Surface failures instead of swallowing them — a rejected adminCall (e.g. a
  // 403 because the session hasn't cleared the 2FA challenge) used to leave the
  // button looking simply dead, with nothing in the UI to explain why.
  // Un-shipping is a plain status flip; shipping goes through the dialog below
  // so a tracking number can be attached before the customer is emailed.
  const unship = async (o: Order) => {
    setErr(null);
    setNote(null);
    setBusy(o.id);
    try {
      await adminCall("set_fulfillment", { orderId: o.id, fulfillment_status: "unfulfilled" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update this order.");
    } finally {
      setBusy(null);
    }
  };

  const confirmShip = async (notify: boolean) => {
    const o = shipFor;
    if (!o) return;
    setErr(null);
    setNote(null);
    setBusy(o.id);
    try {
      const r = await adminCall<{ emailed: boolean; emailNote?: string }>("mark_shipped", {
        orderId: o.id,
        trackingNumber: tracking,
        notify,
      });
      setShipFor(null);
      setTracking("");
      await load();
      setNote(
        r.emailed
          ? `Order #${o.id} marked shipped — ${o.email} has been emailed.`
          : `Order #${o.id} marked shipped. ${r.emailNote ?? "No email sent."}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not mark this order shipped.");
    } finally {
      setBusy(null);
    }
  };

  /* Refunds move real money, so this confirms the exact amount first and
     asks whether the stock should go back on the shelf. */
  const refund = async (o: Order) => {
    const outstanding = o.total_cents - (o.refunded_cents ?? 0);
    const raw = prompt(
      `Refund how much to ${o.email}?\n\nEnter an amount in AUD, or leave as-is to refund the full ${fmt(outstanding, o.currency)} still outstanding on order #${o.id}.`,
      (outstanding / 100).toFixed(2)
    );
    if (raw === null) return;
    const amountCents = Math.round(parseFloat(raw) * 100);
    if (!amountCents || amountCents < 1) return setErr("Enter a refund amount greater than zero.");
    if (amountCents > outstanding)
      return setErr(`That's more than the ${fmt(outstanding, o.currency)} still outstanding on this order.`);
    if (!confirm(`Send ${fmt(amountCents, o.currency)} back to ${o.email}? This cannot be undone.`)) return;
    const restock = confirm("Also put these items back into stock?\n\nOK = restock, Cancel = leave stock as-is.");

    setErr(null);
    setBusy(o.id);
    try {
      await adminCall("refund_order", { orderId: o.id, amountCents, restock });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Orders</h1>
      {err && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {err}
        </div>
      )}
      {note && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          {note}
        </div>
      )}

      {shipFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Ship order #{shipFor.id}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {shipFor.email === "unknown" ? "No email on file for this order." : `We'll email ${shipFor.email}.`}
            </p>
            <label className="mt-4 block text-[11px] text-gray-500">
              Tracking number (optional)
              <input
                autoFocus
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="e.g. 33ABC123456789"
                className="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
            <p className="mt-2 text-[11px] text-gray-500">
              {tracking.trim()
                ? "The email will show this tracking number, linked to Australia Post where we can match the format."
                : "Leave blank and the email will just promise delivery in 3–5 business days."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setShipFor(null); setTracking(""); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmShip(false)}
                disabled={busy === shipFor.id}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-60"
              >
                Ship without emailing
              </button>
              <button
                onClick={() => confirmShip(true)}
                disabled={busy === shipFor.id || shipFor.email === "unknown"}
                className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {busy === shipFor.id ? "Sending…" : "Ship & notify"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5">Payment</th>
              <th className="px-4 py-2.5">Fulfilment</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No orders yet.</td></tr>
            )}
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5 font-semibold">
                    {o.stripe_session_id?.startsWith("shopify-") ? o.stripe_session_id.replace("shopify-", "") : `#${o.id}`}
                    {o.source === "shopify" && (
                      <span className="ml-2 rounded bg-[#d4f7d4] px-1.5 py-0.5 text-[10px] font-semibold text-[#0a6b2d]">
                        Shopify
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{new Date(o.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-2.5">{o.shipping_name ?? (o.email === "unknown" ? "—" : o.email)}</td>
                  <td className="px-4 py-2.5">{fmt(o.total_cents, o.currency)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-[#d5ebff] px-2 py-0.5 text-xs">{o.status}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${o.fulfillment_status === "fulfilled" ? "bg-[#cdfee1]" : "bg-[#ffd6a4]"}`}>
                      {o.fulfillment_status === "fulfilled" ? "shipped" : "not shipped"}
                    </span>
                  </td>
                </tr>
                {open === o.id && (
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid gap-6 md:grid-cols-3">
                        <div>
                          <div className="text-xs font-semibold uppercase text-gray-500">Items</div>
                          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                            {o.order_items.map((i, idx) => (
                              <li key={idx}>
                                {i.quantity}× {i.product_title} <span className="text-gray-500">({i.variant_title})</span> — {fmt(i.unit_price_cents)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase text-gray-500">Ship to</div>
                          <div className="mt-1.5 text-sm">
                            {o.shipping_name}<br />
                            {o.shipping_address?.line1}{o.shipping_address?.line2 ? `, ${o.shipping_address.line2}` : ""}<br />
                            {o.shipping_address?.city} {o.shipping_address?.state} {o.shipping_address?.postal_code}<br />
                            {o.shipping_address?.country}
                            <div className="mt-1 text-gray-500">{o.email === "unknown" ? "—" : o.email}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (o.fulfillment_status === "fulfilled") return unship(o);
                              setTracking(o.tracking_number ?? "");
                              setShipFor(o);
                            }}
                            disabled={busy === o.id}
                            className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white disabled:opacity-60"
                          >
                            {busy === o.id
                              ? "Saving…"
                              : o.fulfillment_status === "fulfilled" ? "Mark unshipped" : "Mark shipped"}
                          </button>
                          {o.tracking_number && (
                            <span className="font-mono text-[11px] text-gray-500">{o.tracking_number}</span>
                          )}
                          {(o.refunded_cents ?? 0) > 0 && (
                            <span className="text-[11px] text-gray-500">
                              {fmt(o.refunded_cents ?? 0, o.currency)} refunded
                            </span>
                          )}
                          {o.source !== "shopify" && (o.refunded_cents ?? 0) < o.total_cents && (
                            <button
                              onClick={(e) => { e.stopPropagation(); refund(o); }}
                              disabled={busy === o.id}
                              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-60"
                            >
                              Refund customer
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
