import { getSettings, jsonSetting } from "@/lib/theme";
import type { LockConfig } from "@/components/LockScreen";

export const LOCK_DEFAULTS: LockConfig = {
  enabled: false,
  ends_at: "",
  heading: "NEXT DROP LOADING",
  body: "Sign up and be first in when the clock hits zero.",
  image: "/site/logo-white.png",
  bg: "#000000",
  fg: "#ffffff",
  accent: "#FE0000",
  collect_email: true,
  collect_phone: false,
};

/* Store + product pages call this; ?unlock=vdg is the documented admin
   bypass for checking the real pages while a drop lock is armed. */
export async function getActiveLock(searchParams?: { unlock?: string }): Promise<LockConfig | null> {
  const settings = await getSettings();
  const cfg = jsonSetting<LockConfig>(settings, "lock_config", LOCK_DEFAULTS);
  if (!cfg.enabled || !cfg.ends_at) return null;
  if (new Date(cfg.ends_at).getTime() <= Date.now()) return null;
  if (searchParams?.unlock === "vdg") return null;
  return cfg;
}
