// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SP = Record<string, string | string[]>;

function getParam(sp: SP, key: string): string {
  const v = sp?.[key];
  if (Array.isArray(v)) return (v[0] ?? '').toString();
  return (v ?? '').toString();
}

export default async function ConfirmPage({
  searchParams,
}: {
  // Next.js 15: searchParams is a Promise
  searchParams: Promise<SP>;
}) {
  const sp = (await searchParams) || {};
  const ref = getParam(sp, 'ref');
  const slug = getParam(sp, 'slug');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  let booking = null;
  if (ref) {
    const { data } = await supabase
      .from('bookings')
      .select('id, patient_name, phone, note, dentist_id, created_at')
      .eq('id', ref)
      .single();
    booking = data || null;
  }

  let dentist = null;
  if (slug) {
    const { data } = await supabase
      .from('dentists')
      .select('id, name, city, slug')
      .eq('slug', slug)
      .single();
    dentist = data || null;
  }

  const ok =
    booking?.dentist_id && dentist?.id && booking.dentist_id === dentist.id;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      {ok ? (
        <div className="rounded-2xl border p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Booking requested ✅</h1>
          <p className="mt-2 text-gray-600">
            Thanks{booking.patient_name ? `, ${booking.patient_name}` : ''}! We’ve
            sent your request to <strong>{dentist.name}</strong>
            {dentist.city ? `, ${dentist.city}` : ''}.
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-medium">Reference:</span> {booking.id}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {booking.phone}
              </div>
              {booking.note ? (
                <div className="mt-1">
                  <span className="font-medium">Note:</span> {booking.note}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Link
              href={`/dentist/${slug}`}
              className="rounded-xl bg-black px-5 py-2 text-white"
            >
              Back to clinic
            </Link>
            <Link
              href={`/dentist/${slug}#booking`}
              className="rounded-xl border px-5 py-2"
            >
              Make another booking
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Tip: Save this page or reference ID for follow‑ups.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">
            We couldn’t find that booking
          </h1>
          <p className="mt-2 text-gray-600">
            The confirmation link is invalid or expired.
          </p>
          <Link
            href={slug ? `/dentist/${slug}` : '/'}
            className="mt-6 inline-block rounded-xl border px-5 py-2"
          >
            Go back
          </Link>
        </div>
      )}
    </main>
  );
}
