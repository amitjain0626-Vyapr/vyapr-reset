// @ts-nocheck
import { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 600;

function slugify(input: string) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const supabase = await createSupabaseServerClient();
  const urls: MetadataRoute.Sitemap = [];

  // Root
  urls.push({
    url: `${base}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  });

  // Microsite pages
  const { data: providers } = await supabase
    .from("Providers")
    .select("slug, updated_at, published")
    .eq("published", true);

  (providers || []).forEach((p) => {
    if (!p.slug) return;
    urls.push({
      url: `${base}/book/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  });

  // Directory pages
  const { data: pairs } = await supabase
    .from("Providers")
    .select("category, location")
    .eq("published", true);

  const seen = new Set<string>();
  (pairs || []).forEach((row) => {
    const cat = (row?.category || "").trim();
    const city = (row?.location || "").trim();
    if (!cat || !city) return;
    const combo = `${slugify(cat)}-${slugify(city)}`;
    if (seen.has(combo)) return;
    seen.add(combo);
    urls.push({
      url: `${base}/directory/${combo}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    });
  });

  return urls;
}
