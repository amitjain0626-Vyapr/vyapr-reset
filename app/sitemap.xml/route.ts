// app/sitemap.xml/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure server runtime

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

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";

  const token = process.env.SITEMAP_INTERNAL_TOKEN || "";
  // Fetch providers via the secure internal API
  let providers: any[] = [];
  try {
    const res = await fetch(`${base}/api/internal/sitemap/providers`, {
      headers: token ? { "x-sitemap-token": token } : {},
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      providers = Array.isArray(json?.data) ? json.data : [];
    }
  } catch {}

  // Build URL list
  const urls: { loc: string; lastmod?: string; freq?: string; prio?: string }[] = [
    { loc: `${base}/`, freq: "daily", prio: "1.0" },
    { loc: `${base}/directory`, freq: "daily", prio: "0.9" },
  ];

  const comboSet = new Set<string>();
  for (const row of providers) {
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
    urls.push({
      loc: `${base}${comboPath(category, city)}`,
      freq: "daily",
      prio: "0.85",
    });
  }

  // XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${
      u.freq ? `\n    <changefreq>${u.freq}</changefreq>` : ""
    }${u.prio ? `\n    <priority>${u.prio}</priority>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`.trim();

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
