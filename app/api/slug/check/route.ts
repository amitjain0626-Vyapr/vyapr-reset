// app/api/slug/check/route.ts
import { NextResponse } from 'next/server';
import { slugify } from '@/app/lib/slugify';
import { createSupabaseServerClient } from '@/app/utils/supabase/server';

export const runtime = 'nodejs';

function isValidSlug(s: string): boolean {
  // 3–60 chars, lowercase a-z0-9 and hyphens, no consecutive hyphens, no edge hyphens
  return /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/.test(s) && !/--/.test(s);
}

export async function POST(req: Request) {
  try {
    const { slug: raw } = await req.json();
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ ok: false, error: 'Slug required' }, { status: 400 });
    }

    const slug = slugify(raw);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ ok: false, error: 'Invalid slug format' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('Dentists')
      .select('slug')
      .eq('slug', slug)
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 });
    }

    const available = (data?.length ?? 0) === 0;
    return NextResponse.json({ ok: true, slug, available });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }
}
