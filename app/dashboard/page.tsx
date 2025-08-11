// app/dashboard/page.tsx
// @ts-nocheck
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          cookieStore.set({ name, value, ...options });
        },
        remove: (name: string, options: any) => {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );
}

export default async function DashboardHome() {
  const supabase = supabaseServer();

  // Require auth
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  // Dentist by current user
  const { data: dentist } = await supabase
    .from('Dentists')
    .select('id, slug, display_name, city, phone')
    .eq('user_id', userId)
    .maybeSingle();

  // Booking link
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const bookingLink = dentist?.slug ? `${siteUrl}/book/${dentist.slug}` : '';

  // Lead count (RLS)
  const { count: leadsCount } = await supabase
    .from('Leads')
    .select('id', { count: 'exact', head: true });

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome{dentist?.display_name ? `, ${dentist.display_name}` : ''}
        </h1>
        <p className="text-sm text-gray-500">Quick snapshot of your clinic microsite.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking link card */}
        <div className="rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Public Booking Link</h2>
            {dentist?.slug && (
              <span className="text-xs rounded-full border px-2 py-0.5">/{dentist.slug}</span>
            )}
          </div>

          {dentist?.slug ? (
            <>
              <div className="font-mono text-sm break-all mb-3">{bookingLink}</div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border px-3 py-2 text-sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(bookingLink);
                    alert('Link copied ✅');
                  }}
                >
                  Copy link
                </button>
                <a
                  className="rounded-xl border px-3 py-2 text-sm"
                  href={bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
                <a
                  className="rounded-xl border px-3 py-2 text-sm"
                  href={`https://wa.me/?text=${encodeURIComponent(`Book here: ${bookingLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on WhatsApp
                </a>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600">
              No microsite slug found.{' '}
              <Link href="/onboarding" className="underline">
                Complete onboarding
              </Link>{' '}
              to generate your link.
            </div>
          )}
        </div>

        {/* Leads summary card */}
        <div className="rounded-2xl border p-5">
          <h2 className="font-medium mb-3">Leads</h2>
          <div className="text-3xl font-semibold mb-4">{leadsCount ?? 0}</div>
          <Link href="/dashboard/leads" className="rounded-xl border px-3 py-2 text-sm inline-block">
            View all
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border p-5">
        <h3 className="font-medium mb-2">Tips</h3>
        <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>Share your booking link on Google Business, Instagram bio, and WhatsApp auto-replies.</li>
          <li>Respond fast — most patients pick the clinic that replies first.</li>
        </ul>
      </div>
    </main>
  );
}
