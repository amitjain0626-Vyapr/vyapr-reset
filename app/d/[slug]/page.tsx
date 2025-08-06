import { createClient } from '../../utils/supabase/server'
import { notFound } from 'next/navigation'

export default async function Page(props: any) {
  const slug = props?.params?.slug
  if (!slug) return notFound()

  const supabase = createClient()
  const { data, error } = await supabase
    .from('dentists')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.error("❌ Supabase error or no data:", error)
    return notFound()
  }

  return (
  <main className="p-4">
    <h1 className="text-xl font-bold mb-4">DEBUG MODE</h1>
    <pre className="bg-gray-900 text-white p-4 rounded text-sm">
      {JSON.stringify(data, null, 2)}
    </pre>
  </main>
)

  )
}
