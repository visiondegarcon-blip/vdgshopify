import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF encoding hangs on this sharp install and every real browser
    // requests AVIF first, so serve webp only.
    formats: ["image/webp"],
  },
};

export default nextConfig;
