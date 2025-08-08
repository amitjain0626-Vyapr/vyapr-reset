// @ts-nocheck
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vyapr.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/d/"],
        disallow: ["/dashboard", "/onboarding", "/auth"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
