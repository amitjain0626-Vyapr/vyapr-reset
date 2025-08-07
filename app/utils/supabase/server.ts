// app/utils/supabase/server.ts
// @ts-nocheck
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const maybe = nextCookies()
  const cookieStore = typeof (maybe as any)?.then === 'function' ? await maybe : maybe

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name, options) {
          try { cookieStore.delete({ name, ...options }) } catch {}
        },
      },
    }
  )
}
