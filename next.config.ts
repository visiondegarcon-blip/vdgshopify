import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF encoding hangs on this sharp install and every real browser
    // requests AVIF first, so serve webp only.
    formats: ["image/webp"],
    // new-drop images uploaded via the admin live in Supabase Storage
    remotePatterns: [
      { protocol: "https", hostname: "sipkcxjgqlfmnvsfcjzy.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
