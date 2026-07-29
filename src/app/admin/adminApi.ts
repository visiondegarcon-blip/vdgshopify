"use client";
import { supabase } from "@/lib/supabase";

export async function adminCall<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `admin ${action} failed`);
  return json as T;
}

export const fmt = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
