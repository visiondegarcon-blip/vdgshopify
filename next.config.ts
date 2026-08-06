import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF encoding hangs on this sharp install and every real browser
    // requests AVIF first, so serve webp only.
    formats: ["image/webp"],
    /* This Next version rejects any `q` not listed here with a 400 — the
       default allows 75 alone. 90 is for the product-page magnifier, which
       needs more detail than the on-page image. */
    qualities: [75, 90],
    // new-drop images uploaded via the admin live in Supabase Storage
    remotePatterns: [
      { protocol: "https", hostname: "sipkcxjgqlfmnvsfcjzy.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  /* Security response headers. SAMEORIGIN (not DENY) because the admin store
     editor previews the live pages in a same-origin iframe — this blocks
     third-party framing/clickjacking while keeping that preview working.
     We intentionally only set `frame-ancestors` in the CSP so scripts/styles
     (Next inline runtime, the WebGL globe, self-hosted fonts) aren't broken;
     a full content CSP can be layered on later with testing. HSTS is already
     served by Vercel. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
