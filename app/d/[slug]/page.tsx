import { createClient } from '../../utils/supabase/server'
import { notFound } from 'next/navigation'

export default async function Page({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data } = await supabase
    .from('dentists')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!data) return notFound()

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Welcome, {data?.name ?? "Name not found"}</h1>
      <img src={data?.profile_pic_url ?? ""} alt="Profile" className="my-2 w-24 h-24 rounded-full" />
      <p><strong>Specialization:</strong> {data?.specialization ?? "Not specified"}</p>
      <p><strong>Location:</strong> {data?.location ?? "Not specified"}</p>
      <p><strong>Bio:</strong> {data?.bio ?? "No bio available."}</p>
      <p><strong>Instagram:</strong> {data?.instagram ?? "—"}</p>
      <p><strong>LinkedIn:</strong> {data?.linkedIn ?? "—"}</p>
      <p><strong>Website:</strong> {data?.website ?? "—"}</p>
    </main>
  )
}
