// app/sitemap.ts
// @ts-nocheck
import type { MetadataRoute } from "next";

export const revalidate = 600; // refresh every 10 min

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
function comboPath(category: string, city: string) {
  return `/directory/${slugify(category)}-${slugify(city)}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changefreq: "daily", priority: 1.0 },
    { url: `${base}/directory`, changefreq: "daily", priority: 0.9 },
  ];

  try {
    // Fetch from our own API (runs in a normal server context)
    const res = await fetch(`${base}/api/public/providers`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const { data } = await res.json();
      const comboSet = new Set<string>();

      for (const row of (data || []) as any[]) {
        const slug = (row.slug || "").toString().trim();
        if (slug) {
          urls.push({
            url: `${base}/book/${slug}`,
            lastModified:
              row.updated_at || row.created_at || new Date().toISOString(),
            changefreq: "weekly",
            priority: 0.8,
          });
        }
        const category = (row.category || "").toString().trim();
        const city = (row.location || "").toString().trim();
        if (category && city) comboSet.add(`${category}|||${city}`);
      }

      for (const key of comboSet) {
        const [category, city] = key.split("|||");
        urls.push({
          url: `${base}${comboPath(category, city)}`,
          changefreq: "daily",
          priority: 0.85,
        });
      }
    }
  } catch {
    // fail-open: keep at least core URLs
  }

  return urls;
}
