// app/d/[slug]/page.tsx

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

  const dentist = data?.[0]

  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">🪷 Debug Mode</h1>

      <div className="mt-4 text-left max-w-xl mx-auto bg-gray-100 p-4 rounded-md text-sm">
        <h2 className="font-semibold">Params</h2>
        <pre>{JSON.stringify(params, null, 2)}</pre>

        <h2 className="font-semibold mt-4">Supabase Error</h2>
        <pre className="text-red-500">{JSON.stringify(error, null, 2)}</pre>

        <h2 className="font-semibold mt-4">Supabase Data</h2>
        <pre className="text-green-700">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  )
}
