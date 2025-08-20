// app/sitemap.ts
// @ts-nocheck
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Force Node runtime; avoids Edge + fetch quirks
export const runtime = "nodejs";

// Canonical base (fallback hard-coded to staging)
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

// Minimal slugify for combos
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
    // Public client — reads allowed by RLS for published=true
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get all published providers
    const { data, error } = await supabase
      .from("Providers")
      .select("slug, updated_at, category, location, published")
      .eq("published", true);

    if (!error && Array.isArray(data)) {
      // 1) Provider microsites
      for (const row of data) {
        if (!row?.slug) continue;
        urls.push({
          url: `${BASE}/book/${row.slug}`,
          changeFrequency: "weekly",
          priority: 0.5,
          lastModified: row?.updated_at ? new Date(row.updated_at) : undefined,
        });
      }

      // 2) Directory combos (unique category+location from published providers)
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
    // Fail-open: keep base URLs only
  }

  // Stable order
  urls.sort((a, b) => a.url.localeCompare(b.url));
  return urls;
}
