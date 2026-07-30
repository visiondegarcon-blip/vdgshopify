/* Server-side theme + content loading. Fetched via Supabase REST with
   Next's fetch cache (60s) so every storefront page can read it cheaply. */

export type ThemeTokens = {
  bg: string;
  fg: string;
  accent: string;
  badge: string;
  bannerBg: string;
  bannerFg: string;
  btnBg: string;
  btnFg: string;
  fontHead: "inconsolata" | "platypi" | "oswald" | "gochi" | "orbitron";
  fontBody: "inconsolata" | "platypi" | "oswald" | "gochi" | "orbitron";
  radius: string;
  texture: "none" | "paper" | "grid";
};

export const DEFAULT_TOKENS: ThemeTokens = {
  bg: "#ffffff",
  fg: "#171717",
  accent: "#FE0000",
  badge: "#a51b1b",
  bannerBg: "#000000",
  bannerFg: "#ffffff",
  btnBg: "#000000",
  btnFg: "#ffffff",
  fontHead: "inconsolata",
  fontBody: "platypi",
  radius: "0px",
  texture: "none",
};

const FONT_VARS: Record<ThemeTokens["fontHead"], string> = {
  inconsolata: "var(--font-inconsolata)",
  platypi: "var(--font-platypi)",
  oswald: "var(--font-oswald)",
  gochi: "var(--font-gochi)",
  orbitron: "var(--font-orbitron)",
};

async function rest<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await rest<{ key: string; value: string }[]>("site_settings?select=key,value");
  return Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
}

export function jsonSetting<T>(settings: Record<string, string>, key: string, fallback: T): T {
  try {
    const raw = settings[key];
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export async function getActiveTheme(previewThemeId?: string): Promise<ThemeTokens> {
  const settings = await getSettings();
  const id = previewThemeId ?? settings.active_theme_id;
  if (!id) return DEFAULT_TOKENS;
  const rows = await rest<{ tokens: Partial<ThemeTokens> }[]>(
    `themes?id=eq.${encodeURIComponent(id)}&select=tokens`,
    previewThemeId ? 0 : 60
  );
  return { ...DEFAULT_TOKENS, ...(rows?.[0]?.tokens ?? {}) };
}

export type ButtonsConfig = {
  add_to_cart: string;
  sold_out: string;
  view_cart: string;
  checkout: string;
  uppercase: boolean;
  radius: string; // e.g. "0px", "8px", "999px"
  style: "fill" | "outline";
};
export const BUTTON_DEFAULTS: ButtonsConfig = {
  add_to_cart: "Add To Cart",
  sold_out: "Sold Out",
  view_cart: "View Cart",
  checkout: "Checkout",
  uppercase: false,
  radius: "",
  style: "fill",
};

export type FontsConfig = { head: ThemeTokens["fontHead"] | ""; body: ThemeTokens["fontBody"] | "" };

/* Editor overrides (fonts + button style) layered on top of the active theme.
   Returns the merged tokens plus extra CSS vars for .t-btn. */
export function applyContentOverrides(
  tokens: ThemeTokens,
  settings: Record<string, string>
): { tokens: ThemeTokens; extraVars: Record<string, string>; buttons: ButtonsConfig } {
  const fonts = jsonSetting<FontsConfig>(settings, "content_fonts", { head: "", body: "" });
  const buttons = jsonSetting<ButtonsConfig>(settings, "content_buttons", BUTTON_DEFAULTS);
  const merged: ThemeTokens = {
    ...tokens,
    ...(fonts.head && FONT_VARS[fonts.head] ? { fontHead: fonts.head } : {}),
    ...(fonts.body && FONT_VARS[fonts.body] ? { fontBody: fonts.body } : {}),
    ...(buttons.radius ? { radius: buttons.radius } : {}),
  };
  const extraVars: Record<string, string> = {
    "--vdg-btn-transform": buttons.uppercase ? "uppercase" : "none",
  };
  if (buttons.style === "outline") {
    extraVars["--vdg-btn-border"] = `2px solid ${tokens.btnBg}`;
    extraVars["--vdg-btn-bg"] = "transparent";
    extraVars["--vdg-btn-fg"] = tokens.btnBg;
  }
  return { tokens: merged, extraVars, buttons };
}

export function themeStyle(t: ThemeTokens): React.CSSProperties {
  return {
    "--vdg-bg": t.bg,
    "--vdg-fg": t.fg,
    "--vdg-accent": t.accent,
    "--vdg-badge": t.badge,
    "--vdg-banner-bg": t.bannerBg,
    "--vdg-banner-fg": t.bannerFg,
    "--vdg-btn-bg": t.btnBg,
    "--vdg-btn-fg": t.btnFg,
    "--vdg-font-head": FONT_VARS[t.fontHead] ?? FONT_VARS.inconsolata,
    "--vdg-font-body": FONT_VARS[t.fontBody] ?? FONT_VARS.platypi,
    "--vdg-radius": t.radius,
  } as React.CSSProperties;
}
