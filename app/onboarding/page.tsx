// @ts-nocheck
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import PublishMicrositeButton from '@/components/onboarding/PublishMicrositeButton';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  // Auth check
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect('/login');

  // If already published, skip onboarding
  // We read published from Dentists; if table/column missing, we fail soft (treat as not published)
  const { data: profile, error } = await supabase
    .from('Dentists')
    .select('published')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!error && profile?.published) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Create your Vyapr microsite</h1>
      <ol className="list-decimal space-y-2 pl-6 text-sm text-gray-700">
        <li>Review your details.</li>
        <li>Choose a URL slug (in Settings later).</li>
        <li>Publish your microsite to go live.</li>
      </ol>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium">Publish</h2>
        <p className="mt-1 text-sm text-gray-600">
          One click. You can unpublish anytime from the dashboard.
        </p>
        <div className="mt-4">
          <PublishMicrositeButton />
        </div>
      </div>
    </div>
  );
}
