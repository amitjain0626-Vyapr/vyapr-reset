// @ts-nocheck
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

async function fetchProvider(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('Providers')
    .select('id, display_name, slug, category, bio, phone, whatsapp, published')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export default async function BookSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await fetchProvider(slug);

  if (!profile || !profile.published) notFound();

  const base = getBaseUrl();
  const url = `${base}/book/${encodeURIComponent(profile.slug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name: profile.display_name ?? slug,
    url,
    description: profile.bio ?? undefined,
    telephone: profile.phone ?? undefined,
    areaServed: 'IN',
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-semibold">
        {profile.display_name ?? 'Provider'}
      </h1>

      {profile.bio && <p className="text-gray-600">{profile.bio}</p>}

      <div className="flex gap-3 pt-2">
        {(profile.whatsapp || profile.phone) && (
          <a
            href={`https://wa.me/${(profile.whatsapp || profile.phone || '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Chat on WhatsApp
          </a>
        )}
        <a
          href="#book"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          Book now
        </a>
      </div>
    </div>
  );
}
