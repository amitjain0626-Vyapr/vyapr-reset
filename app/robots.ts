// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://vyapr.com";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/d/", "/directory"],
      disallow: ["/dashboard", "/onboarding", "/auth"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
