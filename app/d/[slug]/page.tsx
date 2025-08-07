// @ts-nocheck

import { createSupabaseServerClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';

export default async function Page({ params }) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!data || error) {
    notFound();
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{data.name}</h1>
      <p className="text-gray-600">{data.bio}</p>

      <div className="mt-4 space-y-2">
        <a
          href={`https://wa.me/${data.whatsapp}`}
          className="block bg-green-600 text-white px-4 py-2 rounded-md text-center"
        >
          Chat on WhatsApp
        </a>

        {data.razorpay && (
          <a
            href={data.razorpay}
            className="block bg-blue-600 text-white px-4 py-2 rounded-md text-center"
          >
            Pay via Razorpay
          </a>
        )}
      </div>
    </div>
  );
}
