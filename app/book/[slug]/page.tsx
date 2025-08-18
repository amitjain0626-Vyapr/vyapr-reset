// @ts-nocheck
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/site';

type Dentist = {
  id: string;
  display_name: string | null;
  slug: string | null;
  published: boolean | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  created_at: string | null;
};

export const dynamic = 'force-dynamic';

// Fetch once for both metadata + page
async function fetchDentist(slug: string): Promise<Dentist | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('Providers')
    .select('id, display_name, slug, published, bio, phone, whatsapp, created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return null;
  return data as any;
}

// SEO metadata
export async function generateMetadata(
  { params }: { params: { slug: string } },
  parent: any
): Promise<Metadata> {
  const profile = await fetchDentist(params.slug);
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

export default async function BookSlugPage({ params }: { params: { slug: string } }) {
  const profile = await fetchDentist(params.slug);
  if (!profile || !profile.slug) notFound();

  // JSON-LD for AI/SEO (LocalBusiness → Dentist)
  const base = getBaseUrl();
  const url = `${base}/book/${encodeURIComponent(profile.slug)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    '@id': url,
    'name': profile.display_name ?? 'Provider',
    'url': url,
    'description': profile.bio ?? undefined,
    'telephone': profile.phone ?? undefined,
    'areaServed': 'IN',
    'sameAs': [] as string[],
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      {/* SEO: JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ---- your existing UI below (keep as-is) ---- */}
      <h1 className="text-2xl font-semibold">{profile.display_name ?? 'Provider'}</h1>
      {profile.bio && <p className="text-gray-600">{profile.bio}</p>}

      {/* CTA area (example) */}
      <div className="flex gap-3 pt-2">
        <a href={`https://wa.me/${(profile.whatsapp || profile.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
           className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
          Chat on WhatsApp
        </a>
        <a href="#book" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
          Book now
        </a>
      </div>
    </div>
  );
}
