// app/api/leads/create/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { logServerRoute } from '@/lib/supabase/client-helpers'

export async function POST(req: Request) {
  logServerRoute('/api/leads/create')

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()

  const { error } = await supabase
    .from('Leads')
    .insert([{ ...body, created_by: user.id }])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
