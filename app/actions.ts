// app/actions.ts
'use server'
// @ts-nocheck
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'

export async function createDentist(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const phone = String(formData.get('phone') || '').trim() || null
  const city = String(formData.get('city') || '').trim() || null

  if (!name || !slug) redirect('/onboarding')

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: taken } = await supabase
    .from('Dentists')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (taken) redirect('/onboarding')

  await supabase.from('Dentists').insert([
    { user_id: user.id, name, slug, phone, city },
  ])

  redirect('/dashboard')
}

export async function createLead(formData: FormData) {
  const name = String(formData.get('lead_name') || '').trim()
  const phone = String(formData.get('lead_phone') || '').trim()
  const notes = String(formData.get('lead_notes') || '').trim() || null
  const dentist_slug = String(formData.get('dentist_slug') || '').trim().toLowerCase()
  if (!name || !phone || !dentist_slug) return

  const supabase = await createSupabaseServerClient()
  const { data: dentist } = await supabase
    .from('Dentists')
    .select('id, slug')
    .eq('slug', dentist_slug)
    .maybeSingle()
  if (!dentist) return

  await supabase.from('Leads').insert([
    { dentist_id: dentist.id, name, phone, notes, source: 'public_page', status: 'pending' },
  ])
}

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get('lead_id') || '').trim()
  const status = String(formData.get('status') || '').trim().toLowerCase()
  if (!id || !status) return

  const supabase = await createSupabaseServerClient()
  await supabase.from('Leads').update({ status }).eq('id', id)
}

export async function deleteLead(formData: FormData) {
  const id = String(formData.get('lead_id') || '').trim()
  if (!id) return

  const supabase = await createSupabaseServerClient()
  await supabase.from('Leads').delete().eq('id', id)
}

export async function updateDentistProfile(formData: FormData) {
  const id = String(formData.get('id') || '').trim()
  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '').trim().toLowerCase()
  const phone = String(formData.get('phone') || '').trim() || null
  const city = String(formData.get('city') || '').trim() || null

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!id || !name || !slug) redirect('/settings')

  // Enforce slug uniqueness (exclude current record)
  const { data: existing } = await supabase
    .from('Dentists')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) redirect('/settings')

  await supabase
    .from('Dentists')
    .update({ name, slug, phone, city })
    .eq('id', id)
    .eq('user_id', user.id)

  redirect('/settings')
}

export async function deleteAccount(formData: FormData) {
  const id = String(formData.get('id') || '').trim()
  const confirm = String(formData.get('confirm') || '').trim()
  if (!id || confirm !== 'DELETE') return

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Remove dependent leads then profile
  await supabase.from('Leads').delete().eq('dentist_id', id)
  await supabase.from('Dentists').delete().eq('id', id).eq('user_id', user.id)

  await supabase.auth.signOut()
  redirect('/login')
}
