// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function slugify(input: string) {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'user';
}

async function ensureUniqueSlug(supabase: any, candidate: string, ignoreSlug?: string) {
  let base = candidate || 'user';
  let attempt = base;
  let i = 2;
  while (true) {
    const { data } = await supabase
      .from('Providers')
      .select('slug')
      .eq('slug', attempt)
      .maybeSingle();
    if (!data || data.slug === ignoreSlug) return attempt;
    attempt = `${base}-${i++}`;
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  // body (all optional)
  let published = true, desiredSlug: string | null = null, category: string | null = null;
  let displayName: string | null = null, phone: string | null = null, bio: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.published === 'boolean') published = body.published;
    if (typeof body?.slug === 'string') desiredSlug = body.slug;
    if (typeof body?.category === 'string') category = body.category;
    if (typeof body?.display_name === 'string') displayName = body.display_name;
    if (typeof body?.phone === 'string') phone = body.phone;
    if (typeof body?.bio === 'string') bio = body.bio;
  } catch {}

  const fallbackName =
    displayName || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Provider');

  // Load existing (if any) — tolerate 0/1 rows after unique index
  const { data: existing } = await supabase
    .from('Providers')
    .select('id, slug')
    .eq('owner_id', user.id)
    .maybeSingle();

  // Decide final slug
  let finalSlug: string;
  if (existing?.slug && !desiredSlug) {
    finalSlug = existing.slug;
  } else {
    const candidate = slugify(desiredSlug || existing?.slug || fallbackName);
    finalSlug = await ensureUniqueSlug(supabase, candidate, existing?.slug);
  }

  // Build payload
  const payload: any = {
    owner_id: user.id,
    display_name: fallbackName,
    slug: finalSlug,
    category: category || 'general',
    published,
    phone: phone ?? null,
    bio: bio ?? null,
  };

  // Upsert on unique owner_id (requires providers_owner_uidx)
  const { data, error } = await supabase
    .from('Providers')
    .upsert(payload, { onConflict: 'owner_id' })
    .select('id, slug')
    .single(); // deterministic now

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, slug: data.slug });
}
