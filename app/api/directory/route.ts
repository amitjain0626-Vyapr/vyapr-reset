// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('Providers')
    .select('id, display_name, slug, bio, phone, whatsapp, created_at', { count: 'exact' })
    .eq('published', true)
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const base = getBaseUrl(req.headers);
  const providers = (data ?? []).map((d: any) => ({
    id: d.id,
    type: 'dentist',
    name: d.display_name,
    slug: d.slug,
    url: `${base}/book/${encodeURIComponent(d.slug)}`,
    bio: d.bio,
    phone: d.phone,
    whatsapp: d.whatsapp,
    created_at: d.created_at,
    country: 'IN',
  }));

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total: count ?? providers.length,
    providers,
  });
}
