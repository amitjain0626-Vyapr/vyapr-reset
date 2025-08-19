// app/sitemap.ts
// @ts-nocheck
import type { MetadataRoute } from "next";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function comboPath(category: string, city: string) {
  return `/directory/${slugify(category)}-${slugify(city)}`;
}

export const revalidate = 600; // refresh sitemap every 10 minutes

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://vyapr.com";

  // Home & Directory index are always present
  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changefreq: "daily", priority: 1.0 },
    { url: `${base}/directory`, changefreq: "daily", priority: 0.9 },
  ];

  // Pull live providers to build:
  // 1) /book/<slug> pages
  // 2) unique category×city combos under /directory/<category>-<city>
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    // Only published providers are publicly indexed
    const { data, error } = await supabase
      .from("Providers")
      .select("slug, category, location, updated_at, created_at, published")
      .eq("published", true);

    if (!error && Array.isArray(data)) {
      const comboSet = new Set<string>();

      for (const row of data) {
        const slug = (row.slug || "").toString().trim();
        if (slug) {
          urls.push({
            url: `${base}/book/${slug}`,
            lastModified: row.updated_at || row.created_at || new Date().toISOString(),
            changefreq: "weekly",
            priority: 0.8,
          });
        }

        const category = (row.category || "").toString().trim();
        const city = (row.location || "").toString().trim();
        if (category && city) {
          comboSet.add(`${category}|||${city}`);
        }
      }

      // Add the unique directory combos
      for (const key of comboSet) {
        const [category, city] = key.split("|||");
        urls.push({
          url: `${base}${comboPath(category, city)}`,
          changefreq: "daily",
          priority: 0.85,
        });
      }
    }
  } catch (_e) {
    // Fail-open: return at least the core URLs
  }

  return urls;
}
