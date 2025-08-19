// app/sitemap.ts
// @ts-nocheck
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 600;

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

  // Read from either NEXT_PUBLIC_* or server-only fallbacks if you used those names
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/`, changefreq: "daily", priority: 1.0 },
    { url: `${base}/directory`, changefreq: "daily", priority: 0.9 },
  ];

  // If envs missing, return core URLs rather than error
  if (!supabaseUrl || !anonKey) return urls;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });

  const { data, error } = await supabase
    .from("Providers")
    .select("slug, category, location, created_at, updated_at")
    .eq("published", true);

  if (error || !Array.isArray(data)) return urls;

  const comboSet = new Set<string>();
  for (const row of data) {
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

  return urls;
}
