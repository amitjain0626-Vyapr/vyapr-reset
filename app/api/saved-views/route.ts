// app/api/saved-views/route.ts
// Node runtime because we need cookies/session
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// If you already have a helper, use that. Otherwise, fallback to @supabase/ssr.
import { createServerClient } from '@supabase/ssr'

function getSupabaseServerClient() {
  const cookieStore = cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createServerClient(
    url,
    anon,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options })
        },
        remove: (name: string, options: any) => {
          cookieStore.set({ name, value: '', ...options })
        }
      }
    }
  )
  return client
}

// GET /api/saved-views?scope=leads&path=/dashboard/leads
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope') || ''
    const path = searchParams.get('path') || ''

    const supabase = getSupabaseServerClient()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    // Owner-scoped fetch; if your table name differs, change it here
    let query = supabase
      .from('saved_views')
      .select('id,name,scope,path,query,created_at')
      .eq('owner_id', userData.user.id)
      .order('created_at', { ascending: false })

    if (scope) query = query.eq('scope', scope)
    if (path) query = query.eq('path', path)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ items: [], error: error.message }, { status: 200 })
    }
    return NextResponse.json({ items: data ?? [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'unknown' }, { status: 200 })
  }
}

// POST /api/saved-views  body: { name, scope, path, query }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const name = (body?.name || '').toString().trim()
    const scope = (body?.scope || '').toString().trim()
    const path = (body?.path || '').toString().trim()
    const query = (body?.query || '').toString()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!scope) return NextResponse.json({ error: 'Scope is required' }, { status: 400 })
    if (!path) return NextResponse.json({ error: 'Path is required' }, { status: 400 })

    const supabase = getSupabaseServerClient()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const insertRow = {
      owner_id: userData.user.id,
      name,
      scope,
      path,
      query,
    }

    const { data, error } = await supabase
      .from('saved_views')
      .insert(insertRow)
      .select('id,name,scope,path,query,created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown' }, { status: 400 })
  }
}
