// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import BookingForm from '@/components/BookingForm';

export const dynamic = 'force-dynamic';

export default async function DentistPage({ params }) {
  const slug = params.slug;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data: dentist, error } = await supabase
    .from('dentists')
    .select('id, name, city, about, services, slug')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error || !dentist) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold">Clinic not found</h1>
        <p className="mt-2 text-gray-600">
          This microsite is not published or the link is incorrect.
        </p>
      </main>
    );
  }

  const servicesList = Array.isArray(dentist.services)
    ? dentist.services
    : String(dentist.services || '').split(';').map(s => s.trim()).filter(Boolean);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{dentist.name}</h1>
        <p className="text-gray-600">{dentist.city}</p>
      </header>

      {dentist.about && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="mt-2 text-gray-700">{dentist.about}</p>
        </section>
      )}

      {servicesList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold">Services</h2>
          <ul className="mt-2 list-disc list-inside text-gray-700">
            {servicesList.map((service, idx) => (
              <li key={idx}>{service}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Book Appointment</h2>
        <BookingForm slug={dentist.slug} />
      </section>

      <footer className="mt-12 text-xs text-gray-500">
        Powered by Korekko • microsite
      </footer>
    </main>
  );
}
