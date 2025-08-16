import type { NextConfig } from "next";

const isPWAOff = process.env.NEXT_DISABLE_PWA === "1";

let config: NextConfig = {
  experimental: {
    // ✅ Next 15 expects an object, not `true`
    serverActions: {},
  },
  reactStrictMode: true,
  swcMinify: true,
};

if (!isPWAOff) {
  // Load PWA only when enabled
  const withPWA = require("next-pwa")({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
  });
  config = withPWA(config);
}

export default config;
