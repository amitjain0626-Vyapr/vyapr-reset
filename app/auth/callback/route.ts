// app/auth/callback/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code =
    url.searchParams.get('code') ||
    url.searchParams.get('token_hash') ||
    url.searchParams.get('token')

  if (!code) {
    const to = new URL('/login?error=missing_code', req.url)
    return NextResponse.redirect(to)
  }

  // Prepare a mutable response where we will set cookies
  const res = NextResponse.redirect(new URL('/onboarding', req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: any) => {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const fail = new URL('/login?error=auth', req.url)
    return NextResponse.redirect(fail)
  }

  return res
}
