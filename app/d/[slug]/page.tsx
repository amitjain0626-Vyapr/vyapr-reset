import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('Dentists')
    .select('name, description')
    .eq('slug', params.slug)
    .single();

  if (!data) return {};

  return {
    title: `${data.name} | Vyapr`,
    description: data.description || 'Find and book your solo professional online.',
    openGraph: {
      title: `${data.name} | Vyapr`,
      description: data.description || '',
      type: 'website',
      url: `https://vyapr.com/d/${params.slug}`,
    },
  };
}

export default async function SlugPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">{data.name}</h1>
      <p className="text-gray-700 mb-4">{data.description}</p>

      {data.whatsapp && (
        <a
          href={`https://wa.me/${data.whatsapp.replace(/[^\d]/g, '')}`}
          target="_blank"
          className="inline-block bg-green-600 text-white px-4 py-2 rounded"
        >
          Chat on WhatsApp
        </a>
      )}

      {data.razorpay && (
  <a
    href={data.razorpay}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
  >
    Pay / Book Now
  </a>
)}

    </div>
  );
}
