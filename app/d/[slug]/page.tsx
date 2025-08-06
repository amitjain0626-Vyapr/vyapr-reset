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

export default async function SlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('Dentists')
    .select('*, services:Services(*)')
    .eq('slug', params.slug)
    .single();

  if (error || !data) return notFound();

  const trackClick = async (source: 'whatsapp' | 'razorpay') => {
    'use client';
    const client = createClient();
    try {
      await client.from('Leads').insert({
        source,
        slug: params.slug,
      });
    } catch (err) {
      console.error('Lead logging failed:', err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{data.name}</h1>
      <p className="text-gray-700 mb-4">{data.description}</p>

      <div className="space-x-4">
        {data.whatsapp && (
          <a
            href={`https://wa.me/${data.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => trackClick('whatsapp')}
          >
            Chat on WhatsApp
          </a>
        )}

        {data.razorpay && (
          <a
            href={data.razorpay}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => trackClick('razorpay')}
          >
            Pay / Book Now
          </a>
        )}
      </div>

      {data.services?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-3">💼 Services Offered</h2>
          {data.services.map((service) => (
            <div key={service.id} className="border p-4 rounded mb-3 bg-gray-50">
              <h3 className="font-semibold">{service.title}</h3>
              <p className="text-sm mb-1">{service.description}</p>
              <p className="text-xs text-gray-600">
                ₹{service.price} | {service.duration_mins} mins
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
