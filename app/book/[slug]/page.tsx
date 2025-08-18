// @ts-nocheck
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

async function fetchProvider(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('Providers')
    .select('id, display_name, slug, published, bio, phone, whatsapp, category, created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return null;
  return data;
}

// Next 15: params is a Promise — await it
export async function generateMetadata(props: any): Promise<any> {
  const { params } = props;
  const { slug } = await params;

  const profile = await fetchProvider(slug);
  const base = getBaseUrl();

  if (!profile || !profile.slug) {
    return {
      title: 'Profile not found • Vyapr',
      robots: { index: false, follow: false, nocache: true },
    };
  }

  const url = `${base}/book/${encodeURIComponent(profile.slug)}`;
  const title = `${profile.display_name ?? 'Provider'} — Book Now | Vyapr`;
  const description =
    profile.bio?.slice(0, 150) ??
    'Book appointments easily. Powered by Vyapr.';

  const published = !!profile.published;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'Vyapr',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: published
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  };
}

export default async function BookSlugPage(props: any) {
  const { params } = props;
  const { slug } = await params;

  const profile = await fetchProvider(slug);
  if (!profile || !profile.slug) notFound();

  const base = getBaseUrl();
  const url = `${base}/book/${encodeURIComponent(profile.slug)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name: profile.display_name ?? 'Provider',
    url,
    description: profile.bio ?? undefined,
    telephone: profile.phone ?? undefined,
    areaServed: 'IN',
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-2xl font-semibold">{profile.display_name ?? 'Provider'}</h1>
      {profile.bio && <p className="text-gray-600">{profile.bio}</p>}

      <div className="flex gap-3 pt-2">
        <a
          href={`https://wa.me/${(profile.whatsapp || profile.phone || '').replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Chat on WhatsApp
        </a>
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
