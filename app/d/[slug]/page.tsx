import { createClient } from '@/app/utils/supabase/server'
import { notFound } from 'next/navigation'

type Props = {
  params: { slug: string }
}

export default async function Page({ params }: Props) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('dentists')
      .select('*')
      .eq('slug', params.slug)
      .single()

    if (error) {
      console.error('❌ Supabase error:', error.message)
      return (
        <main className="p-4">
          <h1>Something went wrong</h1>
          <p>{error.message}</p>
        </main>
      )
    }

    if (!data) {
      console.warn('⚠️ No dentist found for slug:', params.slug)
      return notFound()
    }

    return (
      <main className="p-4">
        <h1>Welcome, Dr. {data.name || params.slug}</h1>
        <h2>🪥 Speciality: {data.speciality || 'N/A'}</h2>
        <pre className="bg-gray-100 p-2 mt-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </main>
    )
  } catch (err: any) {
    console.error('💥 Unexpected crash:', err.message)
    return (
      <main className="p-4">
        <h1>Unexpected Error</h1>
        <p>{err.message}</p>
      </main>
    )
  }
}
