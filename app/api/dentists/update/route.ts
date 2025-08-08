// app/api/dentists/update/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()

  const { error } = await supabase
    .from('Dentists')
    .update(body)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
