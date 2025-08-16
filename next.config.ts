// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ✅ No swcMinify, no ppr (both deprecated or canary-only)
};

export default nextConfig;
