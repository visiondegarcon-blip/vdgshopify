"use client";
import { useEffect, useState } from "react";
import { adminCall, fmt } from "../adminApi";
import { COUNTRY_NAMES, countryName } from "@/lib/countries";

/* Shipping rates, priced per geographic region and weight bracket.
   Pick a region on the left, edit its Standard/Express ladder on the right.
   Brackets are arbitrary gram values (500g steps by default, but a 3g
   keychain tier works just as well), and anything heavier than the top
   bracket falls back to the per-500g surcharge set at the top. */

type Region = { id: number; name: string; countries: string[]; sort: number };
type Rate = { id: number; region_id: number; service: string; max_weight_g: number; price_cents: number };
type Settings = Record<string, string>;

const input = "mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm";
const label = "mt-3 block text-[11px] text-gray-500";

const gramsLabel = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}kg` : `${g}g`);

export default function ShippingPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await adminCall<{ regions: Region[]; rates: Rate[]; settings: Settings }>("list_shipping");
    setRegions(r.regions);
    setRates(r.rates);
    setSettings(r.settings);
    setSelected((cur) => cur ?? r.regions[0]?.id ?? null);
  };

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Could not load shipping"));
  }, []);

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

  const region = regions.find((r) => r.id === selected) ?? null;
  const ratesFor = (service: string) =>
    rates
      .filter((r) => r.region_id === selected && r.service === service)
      .sort((a, b) => a.max_weight_g - b.max_weight_g);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1a1a1a]">Shipping</h1>
      <p className="mt-1 text-sm text-gray-500">
        Rates are charged on the total weight of the cart, rounded up to the next bracket.
      </p>

      {err && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{err}</div>}
      {msg && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">{msg}</div>}

      {/* Global fallbacks */}
      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Defaults</h2>
        <div className="mt-2 grid gap-4 md:grid-cols-3">
          <label className={label}>
            Default product weight (g)
            <input
              type="number"
              value={settings.shipping_default_weight_g ?? "500"}
              onChange={(e) => setSettings({ ...settings, shipping_default_weight_g: e.target.value })}
              className={input}
            />
            <span className="text-[11px] text-gray-400">Used for any product with no weight set.</span>
          </label>
          <label className={label}>
            Surcharge per extra 500g (AUD)
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
              className={input}
            />
            <span className="text-[11px] text-gray-400">
              Charged on top of the heaviest bracket when an order exceeds it.
            </span>
          </label>
          <label className={label}>
            Allow orders heavier than my brackets
            <select
              value={(settings.shipping_overflow_enabled ?? "true") === "false" ? "false" : "true"}
              onChange={(e) => setSettings({ ...settings, shipping_overflow_enabled: e.target.value })}
              className={input}
            >
              <option value="true">Yes — apply the surcharge</option>
              <option value="false">No — refuse checkout</option>
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
          className="mt-4 rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Save defaults
        </button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[240px_1fr]">
        {/* Region list */}
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="px-2 text-[11px] uppercase tracking-wide text-gray-500">Regions</div>
          <div className="mt-2 flex flex-col gap-0.5">
            {regions.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`rounded-lg px-3 py-1.5 text-left text-sm ${
                  selected === r.id ? "bg-[#1a1a1a] text-white" : "hover:bg-black/5"
                }`}
              >
                {r.name}
                <span className={`ml-1 text-[11px] ${selected === r.id ? "text-white/60" : "text-gray-400"}`}>
                  {r.countries.length}
                </span>
              </button>
            ))}
          </div>
          <button
            disabled={busy}
            onClick={() =>
              run(() => adminCall("save_region", { name: "New region", countries: [], sort: (regions.at(-1)?.sort ?? 0) + 10 }), "Region added.")
            }
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
          >
            + Add region
          </button>
        </div>

        {/* Region detail */}
        {region && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <label className="flex-1 text-[11px] text-gray-500">
                Region name
                <input
                  value={region.name}
                  onChange={(e) =>
                    setRegions(regions.map((r) => (r.id === region.id ? { ...r, name: e.target.value } : r)))
                  }
                  className={input}
                />
              </label>
              <button
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Delete the ${region.name} region and all its rates?`)) return;
                  setSelected(null);
                  run(() => adminCall("delete_region", { id: region.id }), "Region deleted.");
                }}
                className="mt-5 text-xs text-red-600 underline"
              >
                Delete region
              </button>
            </div>

            <label className={label}>
              Countries in this region
              <div className="mt-1 flex flex-wrap gap-1.5">
                {region.countries.map((c) => (
                  <span key={c} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                    {countryName(c)}
                    <button
                      onClick={() =>
                        setRegions(
                          regions.map((r) =>
                            r.id === region.id ? { ...r, countries: r.countries.filter((x) => x !== c) } : r
                          )
                        )
                      }
                      className="text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <select
                value=""
                onChange={(e) => {
                  const c = e.target.value;
                  if (!c) return;
                  setRegions(
                    regions.map((r) =>
                      r.id === region.id && !r.countries.includes(c)
                        ? { ...r, countries: [...r.countries, c] }
                        : r
                    )
                  );
                }}
                className={input}
              >
                <option value="">+ Add a country…</option>
                {Object.keys(COUNTRY_NAMES)
                  .filter((c) => !region.countries.includes(c))
                  .sort((a, b) => COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b]))
                  .map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_NAMES[c]}
                    </option>
                  ))}
              </select>
            </label>

            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  adminCall("save_region", {
                    id: region.id,
                    name: region.name,
                    countries: region.countries,
                    sort: region.sort,
                  })
                )
              }
              className="mt-3 rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Save region
            </button>

            {/* Weight brackets */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {(["standard", "express"] as const).map((service) => (
                <div key={service}>
                  <h3 className="text-[13px] font-semibold capitalize text-[#1a1a1a]">{service}</h3>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead className="text-[11px] uppercase text-gray-500">
                      <tr>
                        <th className="py-1">Up to</th>
                        <th className="py-1">Price</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {ratesFor(service).map((rate) => (
                        <tr key={rate.id} className="border-t border-gray-100">
                          <td className="py-1.5">{gramsLabel(rate.max_weight_g)}</td>
                          <td className="py-1.5">{rate.price_cents === 0 ? "Free" : fmt(rate.price_cents)}</td>
                          <td className="py-1.5 text-right">
                            <button
                              disabled={busy}
                              onClick={() => run(() => adminCall("delete_rate", { id: rate.id }), "Bracket removed.")}
                              className="text-[11px] text-red-600 underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!ratesFor(service).length && (
                        <tr>
                          <td colSpan={3} className="py-3 text-[12px] text-gray-500">
                            No {service} brackets — this option won&apos;t be offered here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <AddBracket
                    busy={busy}
                    suggestG={(ratesFor(service).at(-1)?.max_weight_g ?? 0) + 500}
                    onAdd={(maxWeightG, priceCents) =>
                      run(
                        () => adminCall("save_rate", { regionId: region.id, service, maxWeightG, priceCents }),
                        "Bracket saved."
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddBracket({
  busy,
  suggestG,
  onAdd,
}: {
  busy: boolean;
  suggestG: number;
  onAdd: (maxWeightG: number, priceCents: number) => void;
}) {
  const [g, setG] = useState("");
  const [price, setPrice] = useState("");
  return (
    <div className="mt-2 flex items-end gap-2">
      <label className="flex-1 text-[11px] text-gray-500">
        Up to (g)
        <input
          type="number"
          placeholder={String(suggestG)}
          value={g}
          onChange={(e) => setG(e.target.value)}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex-1 text-[11px] text-gray-500">
        Price (AUD)
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        disabled={busy}
        onClick={() => {
          const grams = parseInt(g || String(suggestG), 10);
          const cents = Math.round(parseFloat(price || "0") * 100);
          if (!grams || grams < 1) return;
          onAdd(grams, cents);
          setG("");
          setPrice("");
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-60"
      >
        Add
      </button>
    </div>
  );
}
