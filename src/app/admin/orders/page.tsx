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

  const load = () =>
    adminCall<{ orders: Order[] }>("list_orders")
      .then((r) => setOrders(r.orders))
      .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const toggleFulfil = async (o: Order) => {
    const next = o.fulfillment_status === "fulfilled" ? "unfulfilled" : "fulfilled";
    await adminCall("set_fulfillment", { orderId: o.id, fulfillment_status: next });
    load();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Orders</h1>
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
                      {o.fulfillment_status}
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
                        <div className="flex items-start justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFulfil(o); }}
                            className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white"
                          >
                            {o.fulfillment_status === "fulfilled" ? "Mark unfulfilled" : "Mark fulfilled"}
                          </button>
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
