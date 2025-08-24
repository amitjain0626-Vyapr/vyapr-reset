// app/api/saved-views/[id]/route.ts
export const runtime = 'nodejs'
// @ts-nocheck

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function getSupabaseServerClient() {
  const cookieStore = cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient(url, anon, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        cookieStore.set({ name, value, ...options })
      },
      remove: (name: string, options: any) => {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}

// DELETE /api/saved-views/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params?.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getSupabaseServerClient()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', id)
      .eq('owner_id', userData.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 400 })
  }
}
