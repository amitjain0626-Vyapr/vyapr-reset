// app/api/slug/check/route.ts
import { NextResponse } from 'next/server'
import { slugify } from '@/lib/slugify'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { name } = await req.json()
  const slug = slugify(name)

  const { data: existing } = await supabase
    .from('Dentists')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const isAvailable = !existing

  return NextResponse.json({ slug, isAvailable })
}
