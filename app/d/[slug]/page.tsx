import { createClient } from '../../utils/supabase/server'
import { notFound } from 'next/navigation'

export default async function Page(props: any) {
  try {
    const slug = props?.params?.slug
    if (!slug) return notFound()

    const supabase = createClient()
    const { data, error } = await supabase
      .from('dentists')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      console.error("❌ Supabase error:", error)
      return notFound()
    }

    return (
      <main className="p-4">
        <h1 className="text-xl font-bold">Welcome, {data.name || "Unknown"}</h1>
        <img
          src={data.profile_pic_url || ""}
          alt="Profile"
          className="my-2 w-24 h-24 rounded-full"
        />
        <p><strong>Specialization:</strong> {data.specialization || "Not specified"}</p>
        <p><strong>Location:</strong> {data.location || "Not specified"}</p>
        <p><strong>Bio:</strong> {data.bio || "No bio available."}</p>
        <p><strong>Instagram:</strong> {data.instagram || "—"}</p>
        <p><strong>LinkedIn:</strong> {data.linkedIn || "—"}</p>
        <p><strong>Website:</strong> {data.website || "—"}</p>
      </main>
    )
  } catch (err) {
    console.error("💥 Server error:", err)
    return notFound()
  }
}
