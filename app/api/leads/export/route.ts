// app/api/leads/export/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const response = new NextResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          response.cookies.set(name, value, { ...options })
        },
        remove: (name: string, options: any) => {
          response.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const { data: dentist, error: dentistErr } = await supabase
    .from('Dentists')
    .select('id, name, slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (dentistErr || !dentist) {
    return new NextResponse('No dentist profile found', { status: 404 })
  }

  const { data: leads, error: leadsErr } = await supabase
    .from('Leads')
    .select('id, name, phone, notes, source, status, created_at')
    .eq('dentist_id', dentist.id)
    .order('created_at', { ascending: false })

  if (leadsErr) {
    return new NextResponse('Failed to fetch leads', { status: 500 })
  }

  const header = [
    'id',
    'name',
    'phone',
    'notes',
    'source',
    'status',
    'created_at',
  ]

  const escape = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = [
    header.join(','),
    ...(leads || []).map((l) =>
      [
        l.id,
        l.name,
        l.phone,
        l.notes ?? '',
        l.source ?? '',
        l.status ?? '',
        l.created_at,
      ]
        .map(escape)
        .join(',')
    ),
  ].join('\n')

  return new NextResponse(rows, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vyapr-leads-${dentist.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
