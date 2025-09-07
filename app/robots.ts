// @ts-nocheck
import type { MetadataRoute } from "next";

// Public pages allowed; keep internal/app/API paths out of the index.
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",        // APIs
          "/dashboard/",  // provider-only
          "/templates",   // gated by slug (avoid thin/duplicate pages)
          "/_next/", "/static/", "/assets/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
