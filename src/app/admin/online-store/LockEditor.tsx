"use client";
import { useEffect, useRef, useState } from "react";
import { adminCall } from "../adminApi";
import LockScreen, { type LockConfig, type LockSocial } from "@/components/LockScreen";
import { LOCK_DEFAULTS } from "@/lib/lock";

/* Full editor for the drop lock. Every control writes the same lock_config
   blob the storefront reads, and the panel on the right renders the real
   LockScreen component scaled down — so what you see is genuinely what ships,
   not an approximation that can drift. */

const SITE_FONTS = [
  ["", "Site default"],
  ["inconsolata", "Inconsolata (mono)"],
  ["platypi", "Platypi (serif)"],
  ["oswald", "Oswald (condensed)"],
  ["gochi", "Gochi Hand (marker)"],
  ["orbitron", "Orbitron (futuristic)"],
] as const;

const LAYOUTS: [LockConfig["layout"], string, string][] = [
  ["centered", "Centered", "Logo, heading and clock stacked in the middle."],
  ["split", "Split", "Image on one side, copy and clock on the other."],
  ["minimal", "Minimal", "Type only — no logo. Stark and fast."],
  ["fullscreen", "Full bleed", "Background photo fills the screen behind the copy."],
];

const DIGITS: [LockConfig["digit_style"], string][] = [
  ["plain", "Plain"],
  ["boxed", "Boxed"],
  ["circle", "Circles"],
];

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm";
const labelCls = "block text-[12px] text-gray-600";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="text-[13px] font-semibold">{title}</div>
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export default function LockEditor() {
  const [cfg, setCfg] = useState<LockConfig>(LOCK_DEFAULTS);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<LockConfig>(LOCK_DEFAULTS);
  /* "now" has to come from an effect, not be read during render — reading the
     clock while rendering is impure and React flags it. */
  const [now, setNow] = useState(0);
  useEffect(() => {
    // scheduled rather than set inline: setState in an effect body cascades
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const set = (next: LockConfig) => {
    ref.current = next;
    setCfg(next);
  };

  useEffect(() => {
    adminCall<{ settings: Record<string, string> }>("get_settings")
      .then((r) => {
        try {
          set({ ...LOCK_DEFAULTS, ...JSON.parse(r.settings.lock_config ?? "{}") });
        } catch {
          set(LOCK_DEFAULTS);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  /* Patch-then-save so a control can change a value and persist in one action;
     reading from the ref avoids losing edits made since the last render. */
  const save = async (patch: Partial<LockConfig> = {}) => {
    const next = { ...ref.current, ...patch };
    set(next);
    await adminCall("update_settings", { settings: { lock_config: JSON.stringify(next) } });
    setMsg(
      !next.enabled
        ? "Saved — lock is off, the store is open."
        : next.scope === "site"
          ? `Saved — the WHOLE site is locked. Preview with ?unlock=${next.bypass_password || "…"}`
          : `Saved — store and product pages are locked. Preview with ?unlock=${next.bypass_password || "…"}`
    );
  };

  const socials: LockSocial[] = cfg.socials ?? [];
  const setSocials = (list: LockSocial[]) => save({ socials: list });

  if (!loaded) return <div className="mt-6 text-sm text-gray-500">Loading lock…</div>;

  const ends = cfg.ends_at ? new Date(cfg.ends_at) : null;
  const past = ends && now ? ends.getTime() <= now : false;

  return (
    <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Drop lock</div>
          <div className="text-[12px] text-gray-500">
            A countdown screen shown instead of the store. Everything below is live on save.
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-300 p-0.5 text-xs">
          {(
            [
              [false, "store", "Off"],
              [true, "store", "Store only"],
              [true, "site", "Whole site"],
            ] as const
          ).map(([enabled, scope, label]) => {
            const active = cfg.enabled === enabled && (!enabled || cfg.scope === scope);
            return (
              <button
                key={label}
                onClick={() => save({ enabled, scope })}
                className={`rounded-md px-2.5 py-1 ${active ? "bg-[#1a1a1a] text-white" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {msg && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">{msg}</p>}
      {cfg.enabled && !cfg.ends_at && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Set a drop time — the lock stays off until there&apos;s a date to count down to.
        </p>
      )}
      {cfg.enabled && past && cfg.unlock_on_zero && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          That time has already passed, so the store is open. Pick a future time to re-arm it.
        </p>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ---------------------------------------------------------- controls */}
        <div className="flex flex-col gap-4">
          <Section title="Timing">
            <label className={labelCls}>
              Drop time
              <input
                type="datetime-local"
                value={toLocalInput(cfg.ends_at)}
                onChange={(e) =>
                  set({ ...cfg, ends_at: e.target.value ? new Date(e.target.value).toISOString() : "" })
                }
                onBlur={() => save()}
                className={inputCls}
              />
            </label>
            <Toggle checked={cfg.unlock_on_zero} onChange={(v) => save({ unlock_on_zero: v })}>
              Open the store automatically when the clock hits zero
            </Toggle>
            <label className={labelCls}>
              Preview password
              <input
                value={cfg.bypass_password}
                onChange={(e) => set({ ...cfg, bypass_password: e.target.value })}
                onBlur={() => save()}
                className={inputCls}
              />
              <span className="text-[11px] text-gray-400">
                Visit any locked page with ?unlock={cfg.bypass_password || "yourword"} to see through it.
              </span>
            </label>
          </Section>

          <Section title="Words">
            <label className={labelCls}>
              Heading
              <input
                value={cfg.heading}
                onChange={(e) => set({ ...cfg, heading: e.target.value })}
                onBlur={() => save()}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Body
              <textarea
                rows={2}
                value={cfg.body}
                onChange={(e) => set({ ...cfg, body: e.target.value })}
                onBlur={() => save()}
                className={inputCls}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelCls}>
                Button label
                <input
                  value={cfg.button_label}
                  onChange={(e) => set({ ...cfg, button_label: e.target.value })}
                  onBlur={() => save()}
                  className={inputCls}
                />
              </label>
              <label className={labelCls}>
                After they sign up
                <input
                  value={cfg.success_text}
                  onChange={(e) => set({ ...cfg, success_text: e.target.value })}
                  onBlur={() => save()}
                  className={inputCls}
                />
              </label>
            </div>
          </Section>

          <Section title="Layout">
            <div className="grid gap-2 md:grid-cols-2">
              {LAYOUTS.map(([key, name, desc]) => (
                <button
                  key={key}
                  onClick={() => save({ layout: key })}
                  className={`rounded-lg border p-3 text-left text-[12px] ${
                    cfg.layout === key ? "border-[#1a1a1a] bg-gray-50" : "border-gray-200"
                  }`}
                >
                  <div className="font-semibold">{name}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className={labelCls}>
                Alignment
                <select
                  value={cfg.align}
                  onChange={(e) => save({ align: e.target.value as LockConfig["align"] })}
                  className={inputCls}
                >
                  <option value="center">Centered</option>
                  <option value="left">Left</option>
                </select>
              </label>
              <label className={labelCls}>
                Heading size
                <select
                  value={cfg.heading_size}
                  onChange={(e) => save({ heading_size: e.target.value as LockConfig["heading_size"] })}
                  className={inputCls}
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Huge</option>
                </select>
              </label>
              <label className={labelCls}>
                Logo height (px)
                <input
                  type="number"
                  value={cfg.image_size}
                  onChange={(e) => set({ ...cfg, image_size: Number(e.target.value) || 0 })}
                  onBlur={() => save()}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(["font_head", "font_body"] as const).map((k) => (
                <label key={k} className={labelCls}>
                  {k === "font_head" ? "Heading font" : "Body font"}
                  <select
                    value={cfg[k]}
                    onChange={(e) => save({ [k]: e.target.value } as Partial<LockConfig>)}
                    className={inputCls}
                  >
                    {SITE_FONTS.map(([v, name]) => (
                      <option key={v} value={v}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Look">
            <div className="flex flex-wrap items-end gap-4">
              {(["bg", "fg", "accent"] as const).map((k) => (
                <label key={k} className="text-[12px] text-gray-600">
                  {k === "bg" ? "Background" : k === "fg" ? "Text" : "Accent"}
                  <input
                    type="color"
                    value={cfg[k]}
                    onChange={(e) => set({ ...cfg, [k]: e.target.value })}
                    onBlur={() => save()}
                    className="mt-1 block h-8 w-14 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <label className={labelCls}>
              Logo image URL
              <input
                value={cfg.image}
                onChange={(e) => set({ ...cfg, image: e.target.value })}
                onBlur={() => save()}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Background photo URL (optional)
              <input
                value={cfg.bg_image}
                onChange={(e) => set({ ...cfg, bg_image: e.target.value })}
                onBlur={() => save()}
                placeholder="Leave blank for a plain colour"
                className={inputCls}
              />
            </label>
            {cfg.bg_image && (
              <label className={labelCls}>
                Darken photo: {cfg.bg_overlay}%
                <input
                  type="range"
                  min={0}
                  max={95}
                  value={cfg.bg_overlay}
                  onChange={(e) => set({ ...cfg, bg_overlay: Number(e.target.value) })}
                  onMouseUp={() => save()}
                  onTouchEnd={() => save()}
                  className="mt-1 w-full"
                />
                <span className="text-[11px] text-gray-400">Keeps the text readable over a busy photo.</span>
              </label>
            )}
          </Section>

          <Section title="The clock">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelCls}>
                Digit style
                <select
                  value={cfg.digit_style}
                  onChange={(e) => save({ digit_style: e.target.value as LockConfig["digit_style"] })}
                  className={inputCls}
                >
                  {DIGITS.map(([v, name]) => (
                    <option key={v} value={v}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col justify-end gap-1.5">
                <Toggle checked={cfg.show_unit_labels} onChange={(v) => save({ show_unit_labels: v })}>
                  Show DAYS / HRS labels
                </Toggle>
                <Toggle checked={cfg.hide_countdown} onChange={(v) => save({ hide_countdown: v })}>
                  Hide the clock entirely (coming-soon page)
                </Toggle>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["show_days", "Days"],
                  ["show_hours", "Hours"],
                  ["show_minutes", "Minutes"],
                  ["show_seconds", "Seconds"],
                ] as const
              ).map(([k, name]) => (
                <Toggle key={k} checked={cfg[k]} onChange={(v) => save({ [k]: v } as Partial<LockConfig>)}>
                  {name}
                </Toggle>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              Hiding a unit rolls its time into the next one shown — turn off Days on a 3-day timer and
              it counts 72 hours.
            </p>
          </Section>

          <Section title="Signup">
            <div className="flex flex-wrap gap-4">
              <Toggle checked={cfg.collect_email} onChange={(v) => save({ collect_email: v })}>
                Email
              </Toggle>
              <Toggle checked={cfg.collect_phone} onChange={(v) => save({ collect_phone: v })}>
                Phone
              </Toggle>
              <Toggle checked={cfg.collect_country} onChange={(v) => save({ collect_country: v })}>
                Country
              </Toggle>
            </div>
            <p className="text-[11px] text-gray-400">
              Signups land in Marketing → Audience, tagged as &quot;countdown&quot;.
            </p>
          </Section>

          <Section title="Links" hint="Shown as a row under the form.">
            {socials.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s.label}
                  placeholder="Instagram"
                  onChange={(e) =>
                    set({
                      ...cfg,
                      socials: socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    })
                  }
                  onBlur={() => save()}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <input
                  value={s.url}
                  placeholder="https://instagram.com/…"
                  onChange={(e) =>
                    set({
                      ...cfg,
                      socials: socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                    })
                  }
                  onBlur={() => save()}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                  className="rounded-lg border border-gray-300 px-2 text-sm text-gray-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => setSocials([...socials, { label: "", url: "" }])}
              className="w-fit rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
            >
              + Add link
            </button>
          </Section>
        </div>

        {/* ----------------------------------------------------------- preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="text-[12px] font-semibold text-gray-600">Live preview</div>
          <div className="mt-2 h-[520px] overflow-hidden rounded-xl border border-gray-200">
            {/* the real component at 40% — scaled, not reimplemented, so the
                preview can't drift from what customers actually see */}
            <div
              style={{
                width: "250%",
                height: "250%",
                transform: "scale(0.4)",
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            >
              <LockScreen
                key={JSON.stringify(cfg)}
                config={{
                  ...cfg,
                  ends_at: cfg.ends_at || (now ? new Date(now + 3 * 864e5).toISOString() : ""),
                  unlock_on_zero: false, // never let the preview reload the admin
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Shows a 3-day placeholder clock until you set a drop time.
          </p>
        </div>
      </div>
    </div>
  );
}
