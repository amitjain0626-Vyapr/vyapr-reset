// app/onboarding/page.tsx
// @ts-nocheck
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server-helpers';
import { ensureDentistProfile, updateDentistProfile } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=NoSession');

  // Fetch using ID only (matches your schema)
  const { data: dentist, error: fetchErr } = await supabase
    .from('Dentists')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const needsCreate = !dentist;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
            Sign out
          </button>
        </form>
      </div>

      <p className="mb-6 text-gray-600">Let’s set up your profile and microsite.</p>

      {needsCreate ? (
        <div className="rounded-xl border p-5">
          <p className="mb-4 text-sm text-gray-700">
            We couldn’t find your profile yet. Click below to create a starter profile for{' '}
            <span className="font-medium">{user.email ?? 'your account'}</span>.
          </p>
          <form action={ensureDentistProfile}>
            <input type="hidden" name="uid" value={user.id} />
            <input type="hidden" name="email" value={user.email ?? ''} />
            <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
              Create my profile
            </button>
          </form>
          {fetchErr ? <p className="mt-3 text-xs text-amber-600">Note: {fetchErr.message}</p> : null}
        </div>
      ) : (
        <form action={updateDentistProfile} className="space-y-4 rounded-xl border p-5">
          <p className="text-sm text-gray-700">Profile found. Continue completing details below.</p>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Display Name</label>
            <input className="w-full rounded-md border px-3 py-2" name="display_name" defaultValue={dentist.display_name ?? ''} placeholder="Dr. Amit Jain" />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Clinic</label>
            <input className="w-full rounded-md border px-3 py-2" name="clinic_name" defaultValue={dentist.clinic_name ?? ''} placeholder="BrightSmile Dental" />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600">Slug</label>
            <input className="w-full rounded-md border px-3 py-2" name="slug" defaultValue={dentist.slug ?? ''} placeholder="dramith" />
          </div>

          <div className="pt-2">
            <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
              Save & Continue
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
