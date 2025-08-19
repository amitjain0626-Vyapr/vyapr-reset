// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { headers } from "next/headers";
import Link from "next/link";
import BookingForm from "./BookingForm";

function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (envUrl) return /^https?:\/\//i.test(envUrl) ? envUrl : `https://${envUrl}`;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function fetchProvider(slug: string) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/providers/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const p = json?.provider ?? json?.data ?? null;
  if (!p) return null;
  return {
    slug: p.slug,
    name: p.display_name ?? p.name ?? slug,
    phone: p.phone ?? null,
    whatsapp: p.whatsapp ?? null,
    bio: p.bio ?? null,
    category: p.category ?? null,
    location: p.location ?? null,
    pageUrl: `${base}/book/${slug}`,
  };
}

export default async function BookingFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await fetchProvider(slug);

  if (!provider) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Booking unavailable</h1>
        <p className="mt-2 text-muted-foreground">This profile does not exist or isn’t published.</p>
        <div className="mt-6"><Link href={`/book/${slug}`} className="underline">Back to profile</Link></div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Request a booking with {provider.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider.category ?? "Services"}{provider.location ? ` • ${provider.location}` : ""}
        </p>
      </header>

      <BookingForm
        slug={provider.slug}
        providerName={provider.name}
        pageHref={`/book/${provider.slug}`}
        phone={provider.phone}
        whatsapp={provider.whatsapp}
        pageUrl={provider.pageUrl}
      />

      <footer className="mt-8 text-center text-xs text-muted-foreground">Powered by Vyapr</footer>
    </main>
  );
}
