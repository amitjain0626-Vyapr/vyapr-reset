// @ts-nocheck
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/app/utils/supabase/server';

export const runtime = 'nodejs';

type Params = { slug: string };

async function getDentist(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('Dentists')
    .select('id, slug, name, clinic_name, city, phone, email, services, published')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data || (data as any).published === false) return null;
  return data as any;
}

export default async function BookPage({ params }: { params: Params }) {
  const dentist = await getDentist(params.slug);
  if (!dentist) return notFound();

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Book with {dentist.name}</h1>
        {dentist.clinic_name ? (
          <p className="text-gray-600">{dentist.clinic_name} • {dentist.city}</p>
        ) : (
          <p className="text-gray-600">{dentist.city}</p>
        )}
      </header>

      <section className="rounded-md border p-4 text-sm space-y-2">
        <p>
          This is a stub checkout page. Clicking the button simulates starting a Razorpay checkout.
        </p>
        <button
          className="rounded-md border px-4 py-2"
          onClick={() => {
            // Stub only: wire real Razorpay later
            console.log('Payment initiated for', dentist.slug);
            alert('Payment initiated (stub). We will integrate Razorpay next.');
          }}
        >
          Pay & Confirm (Stub)
        </button>
      </section>

      <section className="text-xs text-gray-500">
        <p>Services: {dentist.services || 'To be updated'}</p>
        {dentist.phone ? <p>Phone: {dentist.phone}</p> : null}
        {dentist.email ? <p>Email: {dentist.email}</p> : null}
      </section>
    </main>
  );
}
