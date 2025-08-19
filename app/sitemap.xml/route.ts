// app/sitemap.xml/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never serve a prerendered/cached version

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base =
    (process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") as string) ||
    url.origin;

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If envs missing, serve a minimal sitemap (never 500)
  if (!supabaseUrl || !serviceKey) {
    const minimal = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/directory</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
</urlset>`;
    return new NextResponse(minimal, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Server-side Supabase (Service Role) → bypasses RLS safely
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });

  const { data, error } = await supabase
    .from("Providers")
    .select("slug, category, location, created_at, updated_at")
    .eq("published", true);

  const urls: { loc: string; lastmod?: string; freq?: string; prio?: string }[] = [
    { loc: `${base}/`,        freq: "daily",  prio: "1.0"  },
    { loc: `${base}/directory`, freq: "daily",  prio: "0.9"  },
  ];

  if (!error && Array.isArray(data)) {
    const comboSet = new Set<string>();
    for (const row of data) {
      const slug = (row.slug || "").toString().trim();
      if (slug) {
        urls.push({
          loc: `${base}/book/${slug}`,
          lastmod: row.updated_at || row.created_at || new Date().toISOString(),
          freq: "weekly",
          prio: "0.8",
        });
      }
      const category = (row.category || "").toString().trim();
      const city = (row.location || "").toString().trim();
      if (category && city) comboSet.add(`${category}|||${city}`);
    }
    for (const key of comboSet) {
      const [category, city] = key.split("|||");
      urls.push({ loc: `${base}${comboPath(category, city)}`, freq: "daily", prio: "0.85" });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${u.freq ? `\n    <changefreq>${u.freq}</changefreq>` : ""}${u.prio ? `\n    <priority>${u.prio}</priority>` : ""}
  </url>`).join("\n")}
</urlset>`.trim();

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate", // kill any caching
    },
  });
}
