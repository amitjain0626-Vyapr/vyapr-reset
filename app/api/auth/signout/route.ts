// app/api/auth/signout/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { logServerRoute } from '@/lib/supabase/client-helpers'

export async function GET() {
  logServerRoute('/api/auth/signout')

  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL))
}
