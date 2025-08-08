// app/settings/page.tsx
// @ts-nocheck
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'
import { updateDentistProfile, deleteAccount } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: dentist } = await supabase
    .from('Dentists')
    .select('id, name, slug, phone, city')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dentist) redirect('/onboarding')

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-600">Update your public profile and clinic details.</p>
        </header>

        <section className="rounded-2xl border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Public Profile</h2>
          </div>
          <form action={updateDentistProfile} className="p-4 grid gap-4">
            <input type="hidden" name="id" value={dentist.id} />
            <label className="block">
              <span className="text-sm">Clinic / Display Name</span>
              <input
                name="name"
                defaultValue={dentist.name ?? ''}
                required
                className="mt-1 w-full rounded-xl border p-3"
                placeholder="Dr. Amit Jain"
              />
            </label>
            <label className="block">
              <span className="text-sm">Public URL Slug</span>
              <input
                name="slug"
                defaultValue={dentist.slug ?? ''}
                pattern="^[a-z0-9-]+$"
                title="Lowercase letters, numbers, and hyphens only"
                required
                className="mt-1 w-full rounded-xl border p-3"
                placeholder="dr-amit-jain"
              />
              <p className="text-xs mt-1">
                Your page will be at <code>/d/&lt;slug&gt;</code>.
              </p>
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm">Phone</span>
                <input
                  name="phone"
                  defaultValue={dentist.phone ?? ''}
                  className="mt-1 w-full rounded-xl border p-3"
                  placeholder="+91 9xxxxxxxxx"
                />
              </label>
              <label className="block">
                <span className="text-sm">City</span>
                <input
                  name="city"
                  defaultValue={dentist.city ?? ''}
                  className="mt-1 w-full rounded-xl border p-3"
                  placeholder="Gurgaon"
                />
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="rounded-xl border px-4 py-3 font-semibold">
                Save Changes
              </button>
              <a
                className="rounded-xl border px-4 py-3"
                href={`/d/${dentist.slug}`}
                target="_blank"
              >
                View Public Page
              </a>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          </div>
          <form action={deleteAccount} className="p-4 grid gap-3">
            <p className="text-sm">
              This will permanently delete your profile and all leads. This action cannot be undone.
            </p>
            <input type="hidden" name="id" value={dentist.id} />
            <label className="block">
              <span className="text-sm">Type <strong>DELETE</strong> to confirm</span>
              <input
                name="confirm"
                placeholder="DELETE"
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border px-4 py-3 font-semibold text-red-600"
            >
              Delete Account
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
