"use client";
import { useEffect, useState } from "react";
import { adminCall } from "../adminApi";

/* Editable storefront settings — the pieces of the site that change between
   drops without being products: banner text and shipping labels/rates. */

const FIELDS: { key: string; label: string; help: string; type: "text" | "cents" }[] = [
  {
    key: "banner_text",
    label: "Top banner text",
    help: "The black strip shown at the top of every store page. Leave empty to show a plain black bar.",
    type: "text",
  },
  {
    key: "shipping_free_label",
    label: "Free shipping option label",
    help: "Shown at Stripe checkout as the $0 shipping choice.",
    type: "text",
  },
  {
    key: "shipping_intl_label",
    label: "International shipping label",
    help: "Shown at Stripe checkout as the paid shipping choice.",
    type: "text",
  },
  {
    key: "shipping_intl_cents",
    label: "International shipping price (AUD)",
    help: "Charged when the customer picks international shipping.",
    type: "cents",
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    adminCall<{ settings: Record<string, string> }>("get_settings")
      .then((r) => {
        setValues(r.settings);
        setLoaded(true);
      })
      .catch((e) => setMsg(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await adminCall("update_settings", { settings: values });
      sessionStorage.removeItem("vdg-banner");
      setMsg("Saved. Storefront picks this up immediately; open the store in a new tab to see it.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="mt-5 rounded-xl bg-white p-6 shadow-sm">
        {!loaded ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="flex max-w-lg flex-col gap-5">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-[13px] font-medium">{f.label}</span>
                {f.type === "cents" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">A$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={((parseInt(values[f.key] ?? "0", 10) || 0) / 100).toFixed(2)}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: String(Math.round(parseFloat(e.target.value || "0") * 100)) })
                      }
                      className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                )}
                <span className="text-[11px] text-gray-500">{f.help}</span>
              </label>
            ))}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="w-fit rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {msg && <span className="text-xs text-gray-600">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
