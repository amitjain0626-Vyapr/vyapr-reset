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
  const debug = url.searchParams.get("debug") === "1";

  const base =
    (process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") as string) ||
    url.origin;

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Minimal 2-URL sitemap (used if env missing)
  const minimalXml = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/directory</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
</urlset>`;
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  };

  if (!supabaseUrl || !serviceKey) {
    if (debug) {
      return NextResponse.json({
        mode: "env-missing",
        env: { hasSupabaseUrl: !!supabaseUrl, hasServiceRole: !!serviceKey },
      });
    }
    return minimalXml();
  }

  // Query with Service Role (bypass RLS), selecting only existing columns
  let rows: any[] = [];
  let qError: any = null;
  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch },
    });

    // ⚠️ Do NOT select updated_at/created_at (not guaranteed in your DB)
    const res = await supabase
      .from("Providers")
      .select("slug, category, location", { count: "exact" })
      .eq("published", true);

    if (res.error) qError = { message: res.error.message, code: res.error.code };
    rows = Array.isArray(res.data) ? res.data : [];
  } catch (e: any) {
    qError = { message: String(e?.message || e) };
  }

  // Debug JSON mode
  if (debug) {
    return NextResponse.json({
      mode: "debug",
      env: { hasSupabaseUrl: !!supabaseUrl, hasServiceRole: !!serviceKey },
      query: {
        count: rows.length,
        sample: rows.slice(0, 5).map(r => ({
          slug: r.slug ?? null, category: r.category ?? null, location: r.location ?? null,
        })),
        error: qError,
      },
    });
  }

  // Build URLs (no <lastmod> to keep schema-agnostic)
  const urls: { loc: string; freq?: string; prio?: string }[] = [
    { loc: `${base}/`, freq: "daily", prio: "1.0" },
    { loc: `${base}/directory`, freq: "daily", prio: "0.9" },
  ];

  if (!qError && rows.length > 0) {
    const comboSet = new Set<string>();

    for (const row of rows) {
      const slug = (row.slug || "").toString().trim();
      if (slug) {
        urls.push({
          loc: `${base}/book/${slug}`,
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
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.freq ? `\n    <changefreq>${u.freq}</changefreq>` : ""}${u.prio ? `\n    <priority>${u.prio}</priority>` : ""}
  </url>`).join("\n")}
</urlset>`.trim();

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
