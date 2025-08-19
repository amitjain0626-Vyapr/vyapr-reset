// app/api/slug/check/route.ts
import { NextResponse } from 'next/server'
import { slugify } from '@/lib/slugify'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { name } = await req.json()
  const slug = slugify(name)

  const { data: existing } = await supabase
    .from('Providers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const isAvailable = !existing

  return NextResponse.json({ slug, isAvailable })
}
