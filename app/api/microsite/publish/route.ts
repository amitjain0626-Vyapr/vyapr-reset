// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** simple slugify */
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

/** ensure slug uniqueness by appending -2, -3, ... */
async function ensureUniqueSlug(supabase: any, candidate: string) {
  let base = candidate || 'user';
  let attempt = base;
  let i = 2;
  while (true) {
    const { data } = await supabase
      .from('Providers')
      .select('id')
      .eq('slug', attempt)
      .maybeSingle();
    if (!data) return attempt;
    attempt = `${base}-${i++}`;
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  // auth
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // parse body (all fields optional except published)
  let published = true;
  let desiredSlug: string | null = null;
  let category: string | null = null;
  let displayName: string | null = null;
  let phone: string | null = null;
  let bio: string | null = null;

  try {
    const body = await req.json();
    if (typeof body?.published === 'boolean') published = body.published;
    if (typeof body?.slug === 'string') desiredSlug = body.slug;
    if (typeof body?.category === 'string') category = body.category;
    if (typeof body?.display_name === 'string') displayName = body.display_name;
    if (typeof body?.phone === 'string') phone = body.phone;
    if (typeof body?.bio === 'string') bio = body.bio;
  } catch {}

  // defaults from user
  const fallbackName =
    displayName ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'Provider');

  // upsert by owner_id
  const { data: existing, error: fetchErr } = await supabase
    .from('Providers')
    .select('id, slug')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 400 });
  }

  // If row exists → update
  if (existing?.id) {
    // If a new slug is requested, ensure it’s unique; else keep current slug
    let finalSlug = existing.slug;
    if (desiredSlug && desiredSlug !== existing.slug) {
      const candidate = slugify(desiredSlug);
      finalSlug = await ensureUniqueSlug(supabase, candidate);
    }

    const updates: any = {
      published,
    };
    if (finalSlug) updates.slug = finalSlug;
    if (category) updates.category = category;
    if (displayName) updates.display_name = displayName;
    if (phone) updates.phone = phone;
    if (bio) updates.bio = bio;

    const { error: updErr } = await supabase
      .from('Providers')
      .update(updates)
      .eq('id', existing.id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, slug: finalSlug || existing.slug });
  }

  // Else: create new row (generate slug if none)
  const candidate = slugify(desiredSlug || fallbackName);
  const finalSlug = await ensureUniqueSlug(supabase, candidate);

  const payload = {
    owner_id: user.id,
    display_name: fallbackName,
    slug: finalSlug,
    category: category || 'general',
    published,
    phone: phone || null,
    bio: bio || null,
  };

  const { data: ins, error: insErr } = await supabase
    .from('Providers')
    .insert(payload)
    .select('id, slug')
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, slug: ins.slug });
}
