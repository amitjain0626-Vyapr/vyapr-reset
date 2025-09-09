// app/sitemap.ts
// @ts-nocheck
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

const BASE = BRAND.baseUrl;

function slugify(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/directory`, changeFrequency: "daily", priority: 0.6 },
  ];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("Providers")
      .select("slug, created_at, category, location, published")
      .eq("published", true);

    if (!error && Array.isArray(data) && data.length) {
      for (const row of data) {
        if (!row?.slug) continue;
        const lastModified = row?.created_at ? new Date(row.created_at) : undefined;

        urls.push({
          url: `${BASE}/book/${row.slug}`,
          changeFrequency: "weekly",
          priority: 0.5,
          lastModified,
        });

        urls.push({
          url: `${BASE}/microsite/${row.slug}`,
          changeFrequency: "weekly",
          priority: 0.8,
          lastModified,
        });

        urls.push({
          url: `${BASE}/vcard/${row.slug}`,
          changeFrequency: "monthly",
          priority: 0.5,
          lastModified,
        });
      }

      const seen = new Set<string>();
      for (const row of data) {
        const cat = slugify(row?.category);
        const city = slugify(row?.location);
        if (!cat || !city) continue;
        const combo = `${cat}-${city}`;
        if (seen.has(combo)) continue;
        seen.add(combo);
        urls.push({
          url: `${BASE}/directory/${combo}`,
          changeFrequency: "daily",
          priority: 0.55,
        });
      }
    }
  } catch {
    // fail-open
  }

  urls.sort((a, b) => a.url.localeCompare(b.url));
  return urls;
}
