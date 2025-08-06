import { createClient } from '@/app/utils/supabase/server'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`,
  }
}

export default async function DentistPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()

  const { data: dentist, error } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .single()

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
      <p className="mt-2 text-lg text-gray-600">{dentist.specialty} · {dentist.location}</p>
      <p className="mt-4">{dentist.bio}</p>
    </div>
  )
}