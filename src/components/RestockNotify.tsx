"use client";
import { useEffect, useState } from "react";

/* Sold-out capture: instead of a dead end, take an email and tell them when
   the size returns. Resets whenever the shopper switches variant so one
   success message can't linger over a different size. */

export default function RestockNotify({
  variantId,
  variantTitle,
}: {
  variantId: number;
  variantTitle: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState("idle");
    setError(null);
  }, [variantId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/restock-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Could not sign you up.");
      setState("done");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you up.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="mt-4 border border-black px-4 py-3 font-mono text-xs">
        ✓ We&apos;ll email you the moment {variantTitle} is back.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 border border-black px-4 py-3">
      <label htmlFor="restock-email" className="block font-mono text-xs">
        Sold out in {variantTitle}. Get an email when it&apos;s back:
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="restock-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="min-w-0 flex-1 border border-black px-3 py-2 font-mono text-xs"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="t-btn px-4 py-2 font-mono text-xs disabled:opacity-60"
        >
          {state === "sending" ? "…" : "Notify Me"}
        </button>
      </div>
      {error && <p className="mt-2 font-mono text-xs text-red-700">{error}</p>}
    </form>
  );
}
