"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { adminCall } from "./adminApi";

/* Shopify-admin-style shell: dark topbar, light sidebar, grey canvas.
   Gated by Supabase auth + server-side email allowlist. */

const NAV: { label: string; href: string; icon: string }[] = [
  { label: "Home", href: "/admin", icon: "⌂" },
  { label: "Orders", href: "/admin/orders", icon: "▤" },
  { label: "Products", href: "/admin/products", icon: "⬡" },
  { label: "Customers", href: "/admin/customers", icon: "◉" },
  { label: "Analytics", href: "/admin/analytics", icon: "▙" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [unfulfilled, setUnfulfilled] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return setAuthorized(null);
    adminCall<{ email: string }>("me")
      .then(() => setAuthorized(true))
      .catch(() => setAuthorized(false));
  }, [user]);

  useEffect(() => {
    if (!authorized) return;
    adminCall<{ unfulfilled: number }>("stats")
      .then((s) => setUnfulfilled(s.unfulfilled))
      .catch(() => {});
  }, [authorized, pathname]);

  if (!user || authorized === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f1f1] font-sans">
        <div className="w-[360px] rounded-xl bg-white p-8 shadow">
          <div className="text-xl font-semibold text-[#1a1a1a]">VDG Admin</div>
          {authorized === false ? (
            <>
              <p className="mt-3 text-sm text-red-700">
                {user?.email} is not an admin account.
              </p>
              <button onClick={() => supabase.auth.signOut()} className="mt-4 text-sm underline">
                Sign out
              </button>
            </>
          ) : (
            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg(null);
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) setMsg(error.message);
              }}
            >
              <input
                type="email" required placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="password" required placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {msg && <p className="text-xs text-red-700">{msg}</p>}
              <button className="rounded-lg bg-[#1a1a1a] py-2 text-sm font-medium text-white">
                Log in
              </button>
              <p className="text-[11px] text-gray-500">
                Use your store admin account (create it once at /account with your admin email).
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f1f1] font-sans text-[#303030]">
      {/* Topbar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#1a1a1a] px-4 text-white">
        <Link href="/admin" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/logo-white.png" alt="" className="h-8 w-auto" />
          <span className="text-sm font-semibold tracking-wide">VDG Admin</span>
        </Link>
        <div className="flex items-center gap-4 text-xs">
          <a href="https://vdg-store.vercel.app" target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
            View store ↗
          </a>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#36c98e] text-[11px] font-bold text-black">
              VDG
            </span>
            <button onClick={() => supabase.auth.signOut()} className="text-white/60 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="fixed bottom-0 left-0 top-14 z-30 w-[220px] overflow-y-auto bg-[#ebebeb] px-2 py-3 text-sm">
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                  active ? "bg-white font-semibold shadow-sm" : "hover:bg-black/5"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-4 text-center text-[13px] opacity-70">{n.icon}</span>
                  {n.label}
                </span>
                {n.label === "Orders" && unfulfilled > 0 && (
                  <span className="rounded-md bg-[#e0e0e0] px-1.5 text-[11px] font-semibold">{unfulfilled}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-black/10 px-3 pt-3 text-[11px] uppercase tracking-wide text-gray-500">
          Sales channel
        </div>
        <a
          href="https://vdg-store.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-1.5 hover:bg-black/5"
        >
          <span className="w-4 text-center opacity-70">◫</span> Online Store
        </a>
      </aside>

      <main className="ml-[220px] px-8 pb-16 pt-20">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
