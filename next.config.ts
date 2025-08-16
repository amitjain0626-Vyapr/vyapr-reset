// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ✅ removed swcMinify (deprecated)
  experimental: {
    ppr: true,
  },
};

export default nextConfig;
