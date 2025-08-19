// @ts-nocheck
import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";   // disable static/ISR caching
export const revalidate = 0;               // always fresh

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

  // anon supabase (public read of published providers)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const urls: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  // 1) Microsite pages
  const { data: micro, error: em } = await supabase
    .from("Providers")
    .select("slug, published")
    .eq("published", true);

  if (!em && micro?.length) {
    for (const row of micro) {
      const slug = (row?.slug || "").trim();
      if (!slug) continue;
      urls.push({
        url: `${base}/book/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // 2) Directory pages (distinct category/location)
  const { data: pairs, error: ep } = await supabase
    .from("Providers")
    .select("category, location")
    .eq("published", true);

  if (!ep && pairs?.length) {
    const seen = new Set<string>();
    for (const row of pairs) {
      const cat = (row?.category || "").trim();
      const city = (row?.location || "").trim();
      if (!cat || !city) continue;
      const combo = `${slugify(cat)}-${slugify(city)}`;
      if (seen.has(combo)) continue;
      seen.add(combo);
      urls.push({
        url: `${base}/directory/${combo}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return urls;
}
