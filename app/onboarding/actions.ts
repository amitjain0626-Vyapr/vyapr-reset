// app/onboarding/actions.ts
'use server'
// @ts-nocheck
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'

export async function createDentist(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const phone = String(formData.get('phone') || '').trim() || null
  const city = String(formData.get('city') || '').trim() || null

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  const { data: existing } = await supabase
    .from('Dentists')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    // ensure unique slug
    redirect('/onboarding')
  }

  await supabase.from('Dentists').insert([
    {
      user_id: user.id,
      name,
      slug,
      phone,
      city,
    },
  ])

  redirect('/dashboard')
}
