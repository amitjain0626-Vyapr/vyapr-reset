// @ts-nocheck
import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } });

  const urls: MetadataRoute.Sitemap = [];

  // Root
  urls.push({
    url: `${base}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  });

  // Microsite pages (simple, robust)
  const { data: micro } = await supabase
    .from("Providers")
    .select("slug, published")
    .eq("published", true);

  (micro || [])
    .filter((p) => p.slug && typeof p.slug === "string" && p.slug.trim() !== "")
    .forEach((p) => {
      urls.push({
        url: `${base}/book/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    });

  // Directory pages — distinct (category, location)
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
