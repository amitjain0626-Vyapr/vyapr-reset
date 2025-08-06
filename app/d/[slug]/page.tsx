import { createClient } from '../../utils/supabase/server'
import { notFound } from 'next/navigation'

export default async function Page({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!data) return notFound()

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Welcome, Dr. {data.name}</h1>
      <p>Clinic: {data.clinic_name}</p>
      <p>Speciality: {data.speciality}</p>
    </main>
  )
}
