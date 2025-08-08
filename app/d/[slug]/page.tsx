// @ts-nocheck
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function DentistMicrosite({ params }) {
  const supabase = await createSupabaseServerClient()

  const { data: dentist } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!dentist || !dentist.is_published) {
    notFound()
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">{dentist.name}</h1>
      <p className="text-sm text-gray-500">Microsite Slug: {dentist.slug}</p>
    </div>
  )
}
