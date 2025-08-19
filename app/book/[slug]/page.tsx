// @ts-nocheck
// Runtime: force Node to avoid Edge quirks with some libs
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server"; // zero-arg helper per our convention

type Provider = {
  id: string;
  display_name: string | null;
  slug: string;
  category: string | null;
  location: string | null;
  published: boolean;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
};

// --- helpers ---
function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function normalizePhoneForWA(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  // default to India if 10-digit mobile
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits; // handles numbers already starting with country code, etc.
}

async function getProvider(slug: string): Promise<Provider | null> {
  // Primary: read via Supabase with public RLS (published=true)
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("Providers")
      .select("id, display_name, slug, category, location, published, phone, whatsapp, bio")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (!error && data) return data as Provider;
  } catch (e) {
    // fall through to API
    console.error("Supabase read failed, falling back to API:", e);
  }

  // Fallback: internal API (same-domain)
  try {
    const res = await fetch(`/api/providers/${slug}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const provider = json?.provider ?? json?.data ?? null;
      if (provider?.published) return provider as Provider;
    }
  } catch (e) {
    console.error("API fallback failed:", e);
  }

  return null;
}

// --- SEO: dynamic metadata based on provider ---
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProvider(slug);
  if (!provider) {
    return {
      title: "Profile not available • Vyapr",
      description: "This profile is not published or does not exist.",
      robots: { index: false, follow: false },
    };
  }

  const name = provider.display_name ?? "Provider";
  const title = `${name} • ${provider.category ?? "Services"} | Vyapr`;
  const description =
    provider.bio?.slice(0, 160) ??
    `Book ${name}${provider.location ? ` in ${provider.location}` : ""} via Vyapr.`;
  const url = `${getBaseUrl()}/book/${provider.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// --- Page ---
export default async function BookPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params; // Next.js 15 quirk — params is a Promise
  const provider = await getProvider(slug);

  if (!provider) {
    // Visible error state for unpublished/missing profiles
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">This page isn’t available</h1>
        <p className="mt-2 text-muted-foreground">
          The profile you’re looking for doesn’t exist or isn’t published yet.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          If you’re the owner, please publish your microsite from your dashboard.
        </p>
        <div className="mt-6">
          <Link href="/" className="underline">Go to Vyapr</Link>
        </div>
      </main>
    );
  }

  const name = provider.display_name ?? "Provider";
  const baseUrl = getBaseUrl();
  const pageUrl = `${baseUrl}/book/${provider.slug}`;
  const waNumber = normalizePhoneForWA(provider.whatsapp ?? provider.phone ?? "");
  const waText = encodeURIComponent(
    `Hi ${name}, I found your Vyapr page (${pageUrl}). I’d like to book a session.`
  );
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null;
  const telHref = provider.phone ? `tel:${provider.phone.replace(/\s+/g, "")}` : null;

  // LocalBusiness + ReserveAction JSON-LD
  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description: provider.bio ?? undefined,
    url: pageUrl,
    telephone: provider.phone ?? undefined,
    address: provider.location ? { "@type": "PostalAddress", addressLocality: provider.location } : undefined,
    sameAs: waHref ? [waHref] : undefined,
    potentialAction: waHref
      ? {
          "@type": "ReserveAction",
          target: waHref,
        }
      : undefined,
  };

  return (
    <main className="mx-auto max-w-xl p-6">
      {/* JSON-LD for AI/SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <header className="mb-6">
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {provider.category ?? "Services"}
          {provider.location ? ` • ${provider.location}` : ""}
        </p>
      </header>

      {provider.bio && (
        <section className="mb-6">
          <p className="leading-relaxed">{provider.bio}</p>
        </section>
      )}

      <section className="space-y-3">
        {waHref && (
          <a
            href={waHref}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:opacity-95"
            rel="noopener noreferrer"
            target="_blank"
          >
            Book now on WhatsApp
          </a>
        )}

        {telHref && (
          <a
            href={telHref}
            className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-muted/50"
          >
            Call {provider.phone}
          </a>
        )}

        {/* Secondary CTA kept for clarity; both CTAs go to WA in 9.0.
           In 9.1 we’ll change primary to /book/[slug]/form */}
        {waHref && (
          <a
            href={waHref}
            className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-muted/50"
            rel="noopener noreferrer"
            target="_blank"
          >
            Chat on WhatsApp
          </a>
        )}
      </section>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        Powered by Vyapr
      </footer>
    </main>
  );
}
