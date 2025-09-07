// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const sb = admin();
  const { data = [] } = await sb.from("Providers").select("slug, updated_at").limit(200);
  const urls = (data || []).map((r: any) => r.slug).filter(Boolean);

  const locs = new Set<string>();
  for (const slug of urls) {
    locs.add(`${SITE}/book/${slug}`);
    locs.add(`${SITE}/microsite/${slug}`);
  }

  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(locs)
  .map((loc) => `<url><loc>${loc}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
  .join("\n")}
</urlset>`;

  return new NextResponse(body, { headers: { "Content-Type": "application/xml" } });
}
