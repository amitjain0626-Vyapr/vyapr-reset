// @ts-nocheck
import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from '@/utils/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vyapr.com";

  // Static top-level pages (expand later as needed)
  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.2 },
  ];

  // Published dentist microsites
  try {
    const supabase = await createSupabaseServerClient();
    const { data: dentists } = await supabase
      .from("Dentists")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(500);

    const microsites: MetadataRoute.Sitemap = (dentists || [])
      .filter((d: any) => d?.slug)
      .map((d: any) => ({
        url: `${base}/d/${d.slug}`,
        lastModified: d.updated_at ? new Date(d.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [...staticUrls, ...microsites];
  } catch {
    // If Supabase fails, return static only (avoid breaking sitemap)
    return staticUrls;
  }
}
