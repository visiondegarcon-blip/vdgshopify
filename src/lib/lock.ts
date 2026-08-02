import { getSettings, jsonSetting } from "@/lib/theme";
import type { LockConfig } from "@/components/LockScreen";

/* The drop lock. Everything about how it looks is data, so a drop can be a
   stark black countdown one week and a full-bleed photo the next without a
   deploy. Old saved configs keep working: every field added after the first
   version has a default here, and the shape is spread over these defaults on
   read. */

export const LOCK_DEFAULTS: LockConfig = {
  enabled: false,
  scope: "store", // "store" = /store + /products, "site" = everything
  ends_at: "",

  // copy
  heading: "NEXT DROP LOADING",
  body: "Sign up and be first in when the clock hits zero.",
  button_label: "NOTIFY ME",
  success_text: "You're on the list.",

  // layout + type
  layout: "centered", // centered | split | minimal | fullscreen
  align: "center",
  heading_size: "lg",
  font_head: "",
  font_body: "",

  // imagery
  image: "/site/logo-white.png",
  image_size: 192,
  bg_image: "",
  bg_overlay: 55, // % black over the background image, for text legibility

  // colour
  bg: "#000000",
  fg: "#ffffff",
  accent: "#FE0000",

  // countdown
  digit_style: "plain", // plain | boxed | circle
  show_days: true,
  show_hours: true,
  show_minutes: true,
  show_seconds: true,
  show_unit_labels: true,
  hide_countdown: false,

  // signup
  collect_email: true,
  collect_phone: false,
  collect_country: false,

  // extras
  socials: [],
  bypass_password: "vdg",
  unlock_on_zero: true,
};

/* Pages call this to decide whether to render the lock instead of themselves.
   `area` is what the caller is: the site-wide layout passes "site", the store
   and product pages pass "store". */
export async function getActiveLock(
  searchParams?: { unlock?: string },
  area: "site" | "store" = "store"
): Promise<LockConfig | null> {
  const settings = await getSettings();
  const cfg = { ...LOCK_DEFAULTS, ...jsonSetting<LockConfig>(settings, "lock_config", LOCK_DEFAULTS) };
  if (!cfg.enabled || !cfg.ends_at) return null;

  // A store-scoped lock must not take over the whole site; a site-scoped one
  // covers the store too, so only "site" callers can be skipped here.
  if (cfg.scope === "store" && area === "site") return null;

  const ended = new Date(cfg.ends_at).getTime() <= Date.now();
  if (ended && cfg.unlock_on_zero) return null;

  // ?unlock=<password> is how you preview the real pages while armed.
  const pass = (cfg.bypass_password || "").trim();
  if (pass && searchParams?.unlock === pass) return null;

  return cfg;
}
