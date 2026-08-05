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
};

export default nextConfig;
