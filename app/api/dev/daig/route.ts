// app/api/dev/daig/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ user })
}
