// @ts-nocheck
// app/book/[slug]/page.tsx
// Fail-open provider page: never 404s, renders with slug fallback.
// Adds Breadcrumbs + LocalBusiness JSON-LD + WA CTA (only if phone exists).

import ProviderBreadcrumbs from "@/components/seo/ProviderBreadcrumbs";
import { toTitle } from "@/lib/seo/faq";

export const dynamic = "force-dynamic";

// ---------- utils ----------
function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
}

function sanitizePhone(phone?: string | null) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("91") && digits.length === 12) return digits; // +91XXXXXXXXXX
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

function waLink(phone: string | null, text: string) {
  const msg = encodeURIComponent(text);
  if (!phone) return `https://wa.me/?text=${msg}`;
  return `https://wa.me/${phone}?text=${msg}`;
}

async function fetchProvider(slug: string) {
  try {
    const res = await fetch(`${baseUrl()}/api/providers/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.provider ?? null;
  } catch {
    return null;
  }
}

function directorySlugFrom(provider: any): string | undefined {
  const category = String(provider?.category || "").toLowerCase().trim();
  const city = String(provider?.city || "").toLowerCase().trim();
  if (!category || !city) return undefined;
  return `/directory/${category}-${city}`;
}

function displayNameFrom(provider: any, slug: string) {
  return provider?.display_name || provider?.name || provider?.title || toTitle(slug);
}

function localBusinessJsonLd(provider: any, slug: string) {
  const name = displayNameFrom(provider, slug);
  const tel = sanitizePhone(provider?.phone || provider?.whatsapp || provider?.mobile) || null;

  const payload: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: `${baseUrl()}/book/${slug}`,
  };

  if (tel) payload.telephone = `+${tel}`;
  if (provider?.address) {
    payload.address = { "@type": "PostalAddress", streetAddress: String(provider.address) };
  }
  if (provider?.city) {
    payload.areaServed = String(provider.city);
    payload.address = {
      ...(payload.address || { "@type": "PostalAddress" }),
      addressLocality: String(provider.city),
    };
  }
  if (provider?.geo_lat && provider?.geo_lng) {
    payload.geo = {
      "@type": "GeoCoordinates",
      latitude: Number(provider.geo_lat),
      longitude: Number(provider.geo_lng),
    };
  }
  if (provider?.whatsapp) {
    const e164 = sanitizePhone(provider.whatsapp);
    payload.sameAs = [waLink(e164, `Hi ${name}, I found you on Vyapr and want to book.`)];
  }
  return JSON.stringify(payload);
}

// ---------- metadata ----------
export async function generateMetadata({ params }: any): Promise<any> {
  const slug = params?.slug ?? "";
  const provider = await fetchProvider(slug);
  const name = displayNameFrom(provider, slug);

  const title = `${name} | Book Appointment`;
  const desc =
    provider?.bio ||
    provider?.about ||
    `Book ${name} online. Compare services, chat on WhatsApp, and confirm your appointment via Vyapr.`;
  const canonical = `/book/${slug}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: { title, description: desc, url: canonical, type: "website" },
    robots: { index: true, follow: true },
  };
}

// ---------- page ----------
export default async function ProviderPage({ params }: any) {
  const slug = params?.slug ?? "";
  const provider = await fetchProvider(slug); // may be null; we still render
  const name = displayNameFrom(provider, slug);
  const dirSlug = provider ? directorySlugFrom(provider) : undefined;
  const phoneE164 = sanitizePhone(provider?.phone || provider?.whatsapp || provider?.mobile) || null;

  const defaultMessage = `Hi ${name}, I found you on Vyapr and want to book a slot. Can we speak?`;
  const whatsappHref = waLink(phoneE164, defaultMessage);
  const jsonLd = localBusinessJsonLd(provider, slug);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* JSON-LD: LocalBusiness */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Breadcrumbs (UI + JSON-LD) */}
      <ProviderBreadcrumbs providerName={name} directorySlug={dirSlug} />

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{name}</h1>
        {provider?.tagline ? (
          <p className="mt-2 text-gray-700">{String(provider.tagline)}</p>
        ) : (
          <p className="mt-2 text-gray-700">
            Book an appointment or chat on WhatsApp to confirm availability.
          </p>
        )}
        {provider?.city || provider?.locality ? (
          <p className="mt-1 text-sm text-gray-600">
            {provider?.locality ? `${provider.locality}, ` : ""}
            {provider?.city ? String(provider.city) : ""}
          </p>
        ) : null}
      </header>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/book/${encodeURIComponent(slug)}/form`}
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
        >
          Book now
        </a>

        {/* Show WA only if we have a phone */}
        {phoneE164 ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          >
            Chat on WhatsApp
          </a>
        ) : null}
      </div>

      {/* About / Services */}
      <section className="mt-8 space-y-4">
        {provider?.about && (
          <div className="rounded-2xl border p-4">
            <h2 className="text-xl font-semibold mb-2">About</h2>
            <p className="text-sm leading-relaxed text-gray-800">{String(provider.about)}</p>
          </div>
        )}

        {(provider?.services?.length || provider?.highlights?.length) && (
          <div className="rounded-2xl border p-4">
            <h2 className="text-xl font-semibold mb-2">Highlights</h2>
            <ul className="list-disc pl-5 text-sm text-gray-800">
              {(provider?.highlights || []).map((h: any, i: number) => (
                <li key={i}>{String(h)}</li>
              ))}
              {(provider?.services || []).map((s: any, i: number) => (
                <li key={`svc-${i}`}>{String(s?.name || s)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Fallback note */}
      {!provider?.about && !provider?.services?.length && !provider?.highlights?.length ? (
        <p className="mt-6 text-sm text-gray-600">
          Tip: Add a short bio, key services, and locality in your profile to improve conversions.
        </p>
      ) : null}
    </main>
  );
}
