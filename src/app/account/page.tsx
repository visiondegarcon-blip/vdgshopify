"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { supabase, fmtPrice } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Order = {
  id: number;
  total_cents: number;
  currency: string;
  status: string;
  created_at: string;
  order_items: { product_title: string; variant_title: string; quantity: number; unit_price_cents: number }[];
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return setOrders([]);
    supabase
      .from("orders")
      .select("id,total_cents,currency,status,created_at,order_items(product_title,variant_title,quantity,unit_price_cents)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setMsg(error.message);
    else if (mode === "signup") setMsg("Check your email to confirm your account.");
    setLoading(false);
  };

  return (
    <main className="t-surface min-h-screen">
      <Header />
      <div className="mx-auto max-w-md px-4 pb-28">
        <h1 className="font-oswald text-xl font-bold">Account</h1>
        {user ? (
          <>
            <p className="mt-4 text-sm">
              Signed in as <span className="font-semibold">{user.email}</span>
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-2 text-xs underline"
            >
              Sign out
            </button>
            <h2 className="mt-8 font-oswald font-bold">Order History</h2>
            {orders.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                No orders yet. Orders placed with this email will appear here.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {orders.map((o) => (
                  <li key={o.id} className="border border-gray-200 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold">Order #{o.id}</span>
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                    <ul className="mt-2 text-xs text-gray-700">
                      {o.order_items.map((i, idx) => (
                        <li key={idx}>
                          {i.quantity}× {i.product_title} ({i.variant_title}) — {fmtPrice(i.unit_price_cents)}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between">
                      <span className="uppercase text-xs tracking-widest">{o.status}</span>
                      <span className="font-semibold">
                        {fmtPrice(o.total_cents)} {o.currency}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <div className="flex gap-4 text-sm">
              <button
                type="button"
                onClick={() => { setMode("signin"); setMsg(null); }}
                className={mode === "signin" ? "border-b-2 border-black font-semibold" : "text-gray-500"}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setMsg(null); }}
                className={mode === "signup" ? "border-b-2 border-black font-semibold" : "text-gray-500"}
              >
                Create Account
              </button>
            </div>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-black px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-black px-3 py-2 text-sm"
            />
            {msg && <p className="text-sm text-[#a51b1b]">{msg}</p>}
            <button
              type="submit"
              disabled={loading}
              className="t-btn py-2 text-sm disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
