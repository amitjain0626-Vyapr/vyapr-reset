// app/robots.ts
// Next.js 15 compliant robots file (type-only import for MetadataRoute)

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/d/"],
        disallow: ["/dashboard", "/onboarding", "/auth"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
