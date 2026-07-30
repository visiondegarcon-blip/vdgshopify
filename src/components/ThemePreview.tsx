"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/* Applies a theme preview without publishing: /?preview_theme=<id> stores the
   id in sessionStorage (so it follows navigation in this tab) and overrides
   the CSS variables the server rendered. Themes are public-read. */

const VAR_MAP: Record<string, string> = {
  bg: "--vdg-bg",
  fg: "--vdg-fg",
  accent: "--vdg-accent",
  badge: "--vdg-badge",
  bannerBg: "--vdg-banner-bg",
  bannerFg: "--vdg-banner-fg",
  btnBg: "--vdg-btn-bg",
  btnFg: "--vdg-btn-fg",
  radius: "--vdg-radius",
};

const FONT_VARS: Record<string, string> = {
  inconsolata: "var(--font-inconsolata)",
  platypi: "var(--font-platypi)",
  oswald: "var(--font-oswald)",
  gochi: "var(--font-gochi)",
  orbitron: "var(--font-orbitron)",
};

export default function ThemePreview() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("preview_theme");
    if (fromUrl === "off") {
      sessionStorage.removeItem("vdg-preview-theme");
      return;
    }
    const id = fromUrl ?? sessionStorage.getItem("vdg-preview-theme");
    if (!id) return;
    sessionStorage.setItem("vdg-preview-theme", id);
    supabase
      .from("themes")
      .select("tokens")
      .eq("id", Number(id))
      .maybeSingle()
      .then(({ data }) => {
        const tokens = (data?.tokens ?? {}) as Record<string, string>;
        const root = document.documentElement;
        for (const [k, v] of Object.entries(tokens)) {
          if (VAR_MAP[k]) root.style.setProperty(VAR_MAP[k], v);
          if (k === "fontHead" && FONT_VARS[v]) root.style.setProperty("--vdg-font-head", FONT_VARS[v]);
          if (k === "fontBody" && FONT_VARS[v]) root.style.setProperty("--vdg-font-body", FONT_VARS[v]);
          if (k === "texture") {
            document.body.classList.remove("vdg-texture-none", "vdg-texture-paper", "vdg-texture-grid");
            document.body.classList.add(`vdg-texture-${v}`);
          }
        }
        if (!document.getElementById("vdg-preview-pill")) {
          const pill = document.createElement("div");
          pill.id = "vdg-preview-pill";
          pill.textContent = "Theme preview — not published";
          pill.style.cssText =
            "position:fixed;bottom:12px;left:12px;z-index:9999;background:#1a1a1a;color:#fff;padding:6px 10px;font:11px monospace;border-radius:6px;opacity:.85";
          pill.onclick = () => {
            sessionStorage.removeItem("vdg-preview-theme");
            location.href = location.pathname;
          };
          document.body.appendChild(pill);
        }
      });
  }, []);
  return null;
}
