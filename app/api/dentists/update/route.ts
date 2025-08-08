// app/api/dentists/update/route.ts
// @ts-nocheck
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/utils/supabase/server';
import { slugify } from '@/app/lib/slugify';

export const runtime = 'nodejs';

type Body = {
  name?: string;
  clinic_name?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  city?: string;
  services?: string | null;
  hours?: string | null;
  profile_img_url?: string | null;
  clinic_img_url?: string | null;
  published?: boolean;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const patch: Record<string, any> = {};
  const allow: (keyof Body)[] = [
    'name',
    'clinic_name',
    'phone',
    'email',
    'address',
    'city',
    'services',
    'hours',
    'profile_img_url',
    'clinic_img_url',
    'published',
  ];

  for (const k of allow) {
    if (k in body) (patch as any)[k] = (body as any)[k];
  }
  patch.updated_at = new Date().toISOString();

  // Basic guards
  if (patch.name && typeof patch.name !== 'string') delete patch.name;
  if (patch.city && typeof patch.city !== 'string') delete patch.city;
  if ('published' in patch && typeof patch.published !== 'boolean') delete patch.published;

  const { error } = await supabase
    .from('Dentists')
    .update(patch)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
