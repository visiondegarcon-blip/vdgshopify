"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminCall, fmt } from "../adminApi";
import { COUNTRY_NAMES, countryName } from "@/lib/countries";

/* Shipping.
 *
 * A region is "these countries pay this much". Most stores never need more
 * than that, so a region charges one flat price per service by default and the
 * weight ladder is opt-in per region — you only meet brackets if you ask for
 * them. The quote checker at the bottom runs the real pricing function on the
 * server, so what it prints is exactly what a customer would be charged. */

type Region = {
  id: number;
  name: string;
  countries: string[];
  sort: number;
  pricing_mode: "flat" | "weight";
  flat_standard_cents: number | null;
  flat_express_cents: number | null;
};
type Rate = { id: number; region_id: number; service: string; max_weight_g: number; price_cents: number };
type Settings = Record<string, string>;

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm";
const gramsLabel = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}kg` : `${g}g`);
const toAud = (c: number | null) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));
const toCents = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(parseFloat(v) * 100) || 0));

/* Money input that keeps an empty box meaning "not offered" rather than $0 —
   the difference between "no express to Japan" and "free express to Japan". */
function Price({
  value,
  onSave,
  placeholder = "—",
}: {
  value: number | null;
  onSave: (cents: number | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(toAud(value));
  /* Re-sync when a save changes the value underneath us. Adjusting state
     during render is React's documented alternative to an effect here — an
     effect would render the stale price for one frame first. */
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(toAud(value));
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-gray-400">$</span>
      <input
        value={text}
        inputMode="decimal"
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = toCents(text);
          if (next !== value) onSave(next);
        }}
        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
      />
    </div>
  );
}

export default function ShippingPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminCall<{ regions: Region[]; rates: Rate[]; settings: Settings }>("list_shipping");
    setRegions(r.regions);
    setRates(r.rates);
    setSettings(r.settings);
  }, []);

  useEffect(() => {
    // guarded so a slow load resolving after navigation can't set state on an
    // unmounted page
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load shipping");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const run = async (fn: () => Promise<unknown>, okMsg = "Saved.") => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      await load();
      setMsg(okMsg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveRegion = (r: Region, patch: Partial<Region>) =>
    run(() => adminCall("save_region", { ...r, ...patch }));

  const covered = useMemo(() => new Set(regions.flatMap((r) => r.countries)), [regions]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Shipping</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-500">
        Group the countries you ship to into regions, then set what each region costs. Customers pick
        their country in the cart and see only their own rates. Anywhere not listed below can&apos;t
        check out.
      </p>

      {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{err}</div>}
      {msg && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{msg}</div>}

      <QuoteChecker covered={covered} />

      {/* ------------------------------------------------------------ regions */}
      <div className="mt-6 flex flex-col gap-3">
        {regions.map((region) => {
          const isOpen = open === region.id;
          const weightRates = rates
            .filter((r) => r.region_id === region.id)
            .sort((a, b) => a.max_weight_g - b.max_weight_g);
          const summary =
            region.pricing_mode === "weight"
              ? `By weight · ${weightRates.length} ${weightRates.length === 1 ? "bracket" : "brackets"}`
              : [
                  region.flat_standard_cents !== null ? `Standard ${fmt(region.flat_standard_cents)}` : null,
                  region.flat_express_cents !== null ? `Express ${fmt(region.flat_express_cents)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No prices set yet";

          return (
            <div key={region.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <button
                onClick={() => setOpen(isOpen ? null : region.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{region.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-gray-500">
                    {region.countries.length} {region.countries.length === 1 ? "country" : "countries"} · {summary}
                  </div>
                </div>
                <span className="shrink-0 text-gray-400">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-[12px] text-gray-600">
                      Region name
                      <input
                        defaultValue={region.name}
                        onBlur={(e) => e.target.value !== region.name && saveRegion(region, { name: e.target.value })}
                        className={`mt-1 ${inputCls}`}
                      />
                    </label>
                    <div className="text-[12px] text-gray-600">
                      How this region is priced
                      <div className="mt-1 flex gap-1 rounded-lg border border-gray-300 p-0.5">
                        {(
                          [
                            ["flat", "One price"],
                            ["weight", "By weight"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            onClick={() => saveRegion(region, { pricing_mode: mode })}
                            className={`flex-1 rounded-md px-2 py-1 text-xs ${
                              region.pricing_mode === mode ? "bg-[#1a1a1a] text-white" : ""
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* pricing */}
                  {region.pricing_mode === "flat" ? (
                    <div className="mt-4 rounded-lg border border-gray-200 p-4">
                      <div className="text-[12px] font-semibold">What it costs to ship here</div>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        Leave a box empty to not offer that service. Enter 0 for free shipping.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-6">
                        <label className="text-[12px] text-gray-600">
                          Standard
                          <div className="mt-1">
                            <Price
                              value={region.flat_standard_cents}
                              onSave={(c) => saveRegion(region, { flat_standard_cents: c })}
                            />
                          </div>
                        </label>
                        <label className="text-[12px] text-gray-600">
                          Express
                          <div className="mt-1">
                            <Price
                              value={region.flat_express_cents}
                              onSave={(c) => saveRegion(region, { flat_express_cents: c })}
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <WeightLadder
                      region={region}
                      rates={weightRates}
                      busy={busy}
                      onChange={(fn, m) => run(fn, m)}
                    />
                  )}

                  <CountryPicker
                    region={region}
                    takenElsewhere={new Set(
                      regions.filter((r) => r.id !== region.id).flatMap((r) => r.countries)
                    )}
                    onChange={(countries) => saveRegion(region, { countries })}
                  />

                  <div className="mt-5 flex justify-end">
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Delete "${region.name}"? Customers in those countries won't be able to check out.`)) return;
                        run(() => adminCall("delete_region", { id: region.id }), "Region deleted.");
                      }}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700"
                    >
                      Delete region
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          disabled={busy}
          onClick={() =>
            run(
              () => adminCall("save_region", { name: "New region", countries: [], sort: regions.length, pricing_mode: "flat" }),
              "Region added — set its price and countries."
            )
          }
          className="w-fit rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          + Add region
        </button>
      </div>

      {/* --------------------------------------------------------- advanced */}
      <details className="mt-8 rounded-xl bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold">Weight settings</summary>
        <p className="mt-1 text-[12px] text-gray-500">
          These only matter for regions set to &quot;By weight&quot;.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="text-[12px] text-gray-600">
            Default product weight (g)
            <input
              type="number"
              value={settings.shipping_default_weight_g ?? "500"}
              onChange={(e) => setSettings({ ...settings, shipping_default_weight_g: e.target.value })}
              className={`mt-1 ${inputCls}`}
            />
            <span className="text-[11px] text-gray-400">Used for any product with no weight set.</span>
          </label>
          <label className="text-[12px] text-gray-600">
            Surcharge per extra 500g
            <input
              type="number"
              step="0.01"
              value={((parseInt(settings.shipping_overflow_per_500g_cents ?? "1500", 10) || 0) / 100).toString()}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  shipping_overflow_per_500g_cents: String(Math.round(parseFloat(e.target.value || "0") * 100)),
                })
              }
              className={`mt-1 ${inputCls}`}
            />
            <span className="text-[11px] text-gray-400">Added when a cart is heavier than your top bracket.</span>
          </label>
          <label className="text-[12px] text-gray-600">
            Orders heavier than every bracket
            <select
              value={(settings.shipping_overflow_enabled ?? "true") === "false" ? "false" : "true"}
              onChange={(e) => setSettings({ ...settings, shipping_overflow_enabled: e.target.value })}
              className={`mt-1 ${inputCls}`}
            >
              <option value="true">Charge the surcharge</option>
              <option value="false">Refuse checkout</option>
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            run(() =>
              adminCall("update_settings", {
                settings: {
                  shipping_default_weight_g: settings.shipping_default_weight_g ?? "500",
                  shipping_overflow_enabled: settings.shipping_overflow_enabled ?? "true",
                  shipping_overflow_per_500g_cents: settings.shipping_overflow_per_500g_cents ?? "1500",
                },
              })
            )
          }
          className="mt-4 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          Save weight settings
        </button>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------ weight ladder */

function WeightLadder({
  region,
  rates,
  busy,
  onChange,
}: {
  region: Region;
  rates: Rate[];
  busy: boolean;
  onChange: (fn: () => Promise<unknown>, msg?: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {(["standard", "express"] as const).map((service) => {
        const list = rates.filter((r) => r.service === service);
        return (
          <div key={service} className="rounded-lg border border-gray-200 p-4">
            <div className="text-[12px] font-semibold capitalize">{service}</div>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="py-1">Up to</th>
                  <th className="py-1">Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-1.5">{gramsLabel(r.max_weight_g)}</td>
                    <td className="py-1.5">
                      <Price
                        value={r.price_cents}
                        onSave={(c) =>
                          onChange(() =>
                            adminCall("save_rate", { ...r, price_cents: c ?? 0 })
                          )
                        }
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        disabled={busy}
                        onClick={() => onChange(() => adminCall("delete_rate", { id: r.id }), "Bracket removed.")}
                        className="text-xs text-gray-400 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-[12px] text-gray-400">
                      No brackets — this service isn&apos;t offered here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <AddBracket regionId={region.id} service={service} onAdd={onChange} />
          </div>
        );
      })}
    </div>
  );
}

function AddBracket({
  regionId,
  service,
  onAdd,
}: {
  regionId: number;
  service: string;
  onAdd: (fn: () => Promise<unknown>, msg?: string) => void;
}) {
  const [grams, setGrams] = useState("");
  const [price, setPrice] = useState("");
  const valid = Number(grams) > 0 && price.trim() !== "";

  return (
    <div className="mt-2 flex items-end gap-2">
      <label className="text-[11px] text-gray-500">
        Up to (g)
        <input
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          type="number"
          className="mt-0.5 w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-[11px] text-gray-500">
        Price
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className="mt-0.5 w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        disabled={!valid}
        onClick={() => {
          onAdd(
            () =>
              adminCall("save_rate", {
                region_id: regionId,
                service,
                max_weight_g: Math.round(Number(grams)),
                price_cents: toCents(price) ?? 0,
              }),
            "Bracket added."
          );
          setGrams("");
          setPrice("");
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

/* ---------------------------------------------------------- country picker */

function CountryPicker({
  region,
  takenElsewhere,
  onChange,
}: {
  region: Region;
  takenElsewhere: Set<string>;
  onChange: (countries: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.keys(COUNTRY_NAMES)
      .filter((c) => !region.countries.includes(c))
      .filter((c) => !needle || countryName(c).toLowerCase().includes(needle))
      .sort((a, b) => countryName(a).localeCompare(countryName(b)))
      .slice(0, 8);
  }, [q, region.countries]);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <div className="text-[12px] font-semibold">Countries in this region</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {region.countries.map((c) => (
          <span key={c} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[12px]">
            {countryName(c)}
            <button
              onClick={() => onChange(region.countries.filter((x) => x !== c))}
              className="text-gray-400 hover:text-red-700"
              aria-label={`Remove ${countryName(c)}`}
            >
              ✕
            </button>
          </span>
        ))}
        {region.countries.length === 0 && (
          <span className="text-[12px] text-gray-400">None yet — nobody can check out to this region.</span>
        )}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a country to add…"
        className="mt-3 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      />
      {q.trim() && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c}
              onClick={() => {
                onChange([...region.countries, c]);
                setQ("");
              }}
              className="rounded-full border border-gray-300 px-2.5 py-1 text-[12px] hover:bg-gray-50"
            >
              + {countryName(c)}
              {/* a country can only live in one region; adding it here moves it */}
              {takenElsewhere.has(c) && <span className="ml-1 text-amber-600">(moves)</span>}
            </button>
          ))}
          {options.length === 0 && <span className="text-[12px] text-gray-400">No match.</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ quote checker */

/* Calls the same endpoint the cart uses, so this can't quietly disagree with
   what a real customer is charged. */
function QuoteChecker({ covered }: { covered: Set<string> }) {
  const [country, setCountry] = useState("AU");
  const [weight, setWeight] = useState("1000");
  const [result, setResult] = useState<{ service: string; label: string; priceCents: number }[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "none">("idle");

  const check = async () => {
    setState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/shipping-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, weightG: Number(weight) || 0, items: [] }),
      });
      const json = await res.json();
      const quotes = json.quotes ?? [];
      setResult(quotes);
      setState(quotes.length ? "idle" : "none");
    } catch {
      setState("none");
    }
  };

  return (
    <div className="mt-5 rounded-xl bg-white p-5 shadow-sm">
      <div className="text-[13px] font-semibold">What would a customer pay?</div>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Runs your live rules — the same ones the cart uses.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[12px] text-gray-600">
          Shipping to
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {Object.keys(COUNTRY_NAMES)
              .sort((a, b) => countryName(a).localeCompare(countryName(b)))
              .map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                  {covered.has(c) ? "" : " (not covered)"}
                </option>
              ))}
          </select>
        </label>
        <label className="text-[12px] text-gray-600">
          Order weight (g)
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            type="number"
            className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={check}
          className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white"
        >
          {state === "loading" ? "…" : "Check"}
        </button>
      </div>

      {result && result.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {result.map((q) => (
            <li key={q.service} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="capitalize">{q.service}</span>{" "}
              <strong className="tabular-nums">{fmt(q.priceCents)}</strong>
            </li>
          ))}
        </ul>
      )}
      {state === "none" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No rates for {countryName(country)} — add it to a region below or customers there can&apos;t check out.
        </p>
      )}
    </div>
  );
}
