// middleware.ts
// @ts-nocheck
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = new Set<string>(['/','/login','/auth/callback','/favicon.ico'])

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const res = NextResponse.next()

  if (url.searchParams.has('code') && url.pathname !== '/auth/callback') {
    const callbackUrl = url.clone()
    callbackUrl.pathname = '/auth/callback'
    return NextResponse.redirect(callbackUrl)
  }

  if (PUBLIC_PATHS.has(url.pathname) || url.pathname.startsWith('/_next/')) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return req.cookies.get(name)?.value },
        set(name, value, options) { res.cookies.set(name, value, options) },
        remove(name, options) { res.cookies.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = url.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(png|jpg|jpeg|gif|webp|svg)$).*)'],
}
