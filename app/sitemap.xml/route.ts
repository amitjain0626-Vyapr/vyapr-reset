// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('Providers')
    .select('slug, created_at')
    .eq('published', true)
    .not('slug', 'is', null);

  const base = getBaseUrl(req.headers);

  if (error) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>${base}</loc></url>
    </urlset>`;
    return new NextResponse(fallback, { headers: { 'Content-Type': 'application/xml' } });
  }

  const urls = (data ?? []).map((row: any) => {
    const loc = `${base}/book/${encodeURIComponent(row.slug)}`;
    const lastmod = new Date(row.created_at ?? Date.now()).toISOString();
    return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${base}</loc><changefreq>weekly</changefreq><priority>0.3</priority></url>
    ${urls.join('\n')}
  </urlset>`;

  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
