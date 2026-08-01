"use client";
import { useEffect, useState } from "react";
import { adminCall } from "../adminApi";
import { listTotpFactors, startEnroll, verifyEnroll, disableTotp } from "../mfa";

/* Editable storefront settings — the pieces of the site that change between
   drops without being products. Shipping rates moved to their own Shipping
   section, where they're priced per region and weight bracket. */

const FIELDS: { key: string; label: string; help: string; type: "text" | "cents" }[] = [
  {
    key: "banner_text",
    label: "Top banner text",
    help: "The black strip shown at the top of every store page. Leave empty to show a plain black bar.",
    type: "text",
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

      <TwoFactorSection />
    </div>
  );
}

function TwoFactorSection() {
  const [status, setStatus] = useState<"loading" | "off" | "on" | "enrolling">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const factors = await listTotpFactors();
    const verified = factors.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStatus("on");
    } else {
      setFactorId(null);
      setStatus("off");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const beginEnroll = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const data = await startEnroll();
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStatus("enrolling");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not start enrollment");
    }
    setBusy(false);
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setMsg(null);
    setBusy(true);
    try {
      await verifyEnroll(factorId, code);
      setCode("");
      setQr(null);
      setSecret(null);
      await refresh();
      setMsg("Two-factor authentication is now on.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Invalid code — try again.");
    }
    setBusy(false);
  };

  const disable = async () => {
    if (!factorId) return;
    if (!confirm("Turn off two-factor authentication? Your account will only need a password to sign in.")) return;
    setBusy(true);
    try {
      await disableTotp(factorId);
      await refresh();
      setMsg("Two-factor authentication is now off.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not disable");
    }
    setBusy(false);
  };

  return (
    <div className="mt-6 max-w-lg rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold">Two-factor authentication</h2>
      <p className="mt-1 text-[11px] text-gray-500">
        Adds a 6-digit code from an app like Google Authenticator, Authy, or 1Password on top of your
        password.
      </p>

      {status === "loading" && <p className="mt-4 text-sm text-gray-500">Loading…</p>}

      {status === "off" && (
        <button
          onClick={beginEnroll}
          disabled={busy}
          className="mt-4 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {status === "enrolling" && qr && (
        <form onSubmit={confirmEnroll} className="mt-4 flex flex-col gap-3">
          <p className="text-sm">Scan this with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="TOTP QR code" className="h-40 w-40" />
          {secret && (
            <p className="break-all text-[11px] text-gray-500">
              Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span>
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
          />
          <div className="flex items-center gap-3">
            <button
              disabled={busy}
              className="w-fit rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("off");
                setQr(null);
              }}
              className="text-xs text-gray-500 underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {status === "on" && (
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-md bg-[#36c98e]/20 px-2 py-1 text-xs font-medium text-[#0e6b47]">
            Enabled
          </span>
          <button onClick={disable} disabled={busy} className="text-xs text-red-700 underline">
            Turn off
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
