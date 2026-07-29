"use client";
import { useEffect, useState } from "react";
import { adminCall, fmt } from "../adminApi";

type Customer = { email: string; name: string | null; orders: number; spentCents: number; last: string };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminCall<{ customers: Customer[] }>("customers")
      .then((r) => setCustomers(r.customers))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Customers</h1>
      <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Orders</th>
              <th className="px-4 py-2.5">Total spent</th>
              <th className="px-4 py-2.5">Last order</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No customers yet.</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.email} className="border-b border-gray-100">
                <td className="px-4 py-2.5 font-medium">{c.name ?? "—"}</td>
                <td className="px-4 py-2.5">{c.email}</td>
                <td className="px-4 py-2.5">{c.orders}</td>
                <td className="px-4 py-2.5">{fmt(c.spentCents)}</td>
                <td className="px-4 py-2.5">{new Date(c.last).toLocaleDateString("en-AU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
