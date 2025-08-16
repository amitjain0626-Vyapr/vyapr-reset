import type { NextConfig } from "next";

// Check env flag
const isPWAOff = process.env.NEXT_DISABLE_PWA === "1";

let config: NextConfig = {
  experimental: {
    serverActions: true,
  },
  reactStrictMode: true,
  swcMinify: true,
};

if (!isPWAOff) {
  // Only load next-pwa if enabled
  const withPWA = require("next-pwa")({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
  });
  config = withPWA(config);
}

export default config;
