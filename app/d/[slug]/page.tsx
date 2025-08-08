// app/d/[slug]/page.tsx
// @ts-nocheck
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'
import { createLead } from '@/app/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: { slug: string }
}

export default async function DentistPublicPage({ params }: Props) {
  const supabase = await createSupabaseServerClient()

  const { data: dentist } = await supabase
    .from('Dentists')
    .select('id, name, city, phone, slug')
    .eq('slug', params.slug.toLowerCase())
    .maybeSingle()

  if (!dentist) notFound()

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">{dentist.name}</h1>
          <span className="text-xs rounded-full border px-2 py-1">{dentist.city || '—'}</span>
        </header>

        <section className="rounded-2xl border p-4">
          <h2 className="text-xl font-semibold mb-2">About</h2>
          <p className="text-sm">
            This is the public microsite for <strong>{dentist.name}</strong>. Share your details below and the clinic will contact you.
          </p>
        </section>

        <section className="rounded-2xl border p-4">
          <h3 className="text-lg font-semibold mb-2">Book a callback</h3>
          <form action={createLead} className="grid gap-3 sm:max-w-md">
            <input type="hidden" name="dentist_slug" value={dentist.slug} />
            <label className="block">
              <span className="text-sm">Your Name</span>
              <input
                name="lead_name"
                required
                className="mt-1 w-full rounded-xl border p-3"
                placeholder="Your full name"
              />
            </label>
            <label className="block">
              <span className="text-sm">Phone</span>
              <input
                name="lead_phone"
                required
                className="mt-1 w-full rounded-xl border p-3"
                placeholder="+91 9xxxxxxxxx"
              />
            </label>
            <label className="block">
              <span className="text-sm">Notes (optional)</span>
              <textarea
                name="lead_notes"
                className="mt-1 w-full rounded-xl border p-3"
                placeholder="Preferred time, treatment interest, etc."
                rows={3}
              />
            </label>
            <button type="submit" className="rounded-xl border px-4 py-3 font-semibold">
              Request callback
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
