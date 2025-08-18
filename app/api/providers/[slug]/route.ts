// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('Providers')
    .select('id, display_name, slug, published, bio, phone, whatsapp, created_at')
    .eq('slug', params.slug)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  if (!data.published) {
    // Only expose published profiles
    return NextResponse.json({ ok: false, error: 'Not published' }, { status: 404 });
  }

  const base = getBaseUrl();
  const url = `${base}/book/${encodeURIComponent(data.slug)}`;

  return NextResponse.json({
    ok: true,
    provider: {
      id: data.id,
      type: 'dentist',
      name: data.display_name,
      slug: data.slug,
      url,
      bio: data.bio,
      phone: data.phone,
      whatsapp: data.whatsapp,
      created_at: data.created_at,
      country: 'IN',
      // add fields later: location, services, prices, languages, hours, etc.
    },
  });
}
