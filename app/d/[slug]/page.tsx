import { createClient } from '@/app/utils/supabase/server'

export async function generateMetadata({ params }: any) {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`,
  }
}

export default async function DentistPage({ params }: any) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('dentists')
    .select('*')
    .eq('slug', params.slug)

  console.log('🪷 Supabase Data:', data)
  console.error('❌ Supabase Error:', error)

  const dentist = data?.[0] // ✅ bypass `.single()` to avoid internal error

  if (error || !dentist) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold text-red-500">Dentist not found</h1>
        <p>Please check the URL or try again later.</p>
      </div>
    )
  }

  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Welcome, {dentist.name}</h1>
      <p className="mt-2 text-lg text-gray-600">
        {dentist.specialty} · {dentist.location}
      </p>
      <p className="mt-4">{dentist.bio}</p>
    </div>
  )
}