// app/sitemap.xml/route.ts
// @ts-nocheck

// Force Node runtime for supabase server client compatibility
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

// Helpers
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

// simple XML escaper
const esc = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Serialize a set of <url> entries
function buildUrlset(urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }>) {
  const items = urls
    .map(u => {
      const loc = esc(u.loc);
      const lastmod = u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : "";
      const changefreq = u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "";
      const priority = u.priority ? `<priority>${u.priority}</priority>` : "";
      return `<url><loc>${loc}</loc>${lastmod}${changefreq}${priority}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

// Safe Supabase server client (no auth required for public reads)
async function getSupabase() {
  const c = await cookies();
  const h = await headers();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => c.get(name)?.value }, headers: { get: (name: string) => h.get(name) || "" } }
  );
}

export async function GET() {
  // Always include these
  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
    { loc: `${BASE}/`, changefreq: "daily", priority: "0.8" },
    { loc: `${BASE}/directory`, changefreq: "daily", priority: "0.6" }, // NEW: directory index
  ];

  try {
    const supabase = await getSupabase();

    // 1) Provider microsites: /book/[slug]
    const { data: providers, error: pErr } = await supabase
      .from("Providers")
      .select("slug, updated_at, category, location, published")
      .eq("published", true);

    if (!pErr && providers && providers.length) {
      // provider pages
      for (const row of providers) {
        if (!row?.slug) continue;
        urls.push({
          loc: `${BASE}/book/${row.slug}`,
          changefreq: "weekly",
          priority: "0.5",
          lastmod: row?.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        });
      }

      // 2) Directory combos: unique (category, location) pairs from published providers
      const seen = new Set<string>();
      for (const row of providers) {
        const cat = String(row?.category || "").trim().toLowerCase().replace(/\s+/g, "-");
        const city = String(row?.location || "").trim().toLowerCase().replace(/\s+/g, "-");
        if (!cat || !city) continue;
        const combo = `${cat}-${city}`;
        if (seen.has(combo)) continue;
        seen.add(combo);
        urls.push({
          loc: `${BASE}/directory/${combo}`,
          changefreq: "daily",
          priority: "0.55",
        });
      }
    }

    // Sort for stability
    urls.sort((a, b) => a.loc.localeCompare(b.loc));
  } catch {
    // Fail-open: keep base URLs only
  }

  const xml = buildUrlset(urls);
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
