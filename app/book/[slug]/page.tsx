// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Provider = {
  id: string;
  display_name?: string | null;
  name?: string | null; // API sometimes sends `name`
  slug: string;
  category?: string | null;
  location?: string | null;
  published?: boolean | null;
  phone?: string | null;
  whatsapp?: string | null;
  bio?: string | null;
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function normalizePhoneForWA(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

function titleFromSlug(slug?: string) {
  if (!slug) return "Provider";
  return slug
    .split(/[-_]+/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function coalesceName(p: Partial<Provider>) {
  return p.display_name?.trim() || p.name?.trim() || titleFromSlug(p.slug);
}

function normalizeProvider(raw: any): Provider | null {
  if (!raw) return null;
  // Accept both DB and API shapes; ensure fields exist
  return {
    id: raw.id,
    display_name: raw.display_name ?? raw.name ?? null,
    name: raw.name ?? null,
    slug: raw.slug,
    category: raw.category ?? null,
    location: raw.location ?? null,
    published: typeof raw.published === "boolean" ? raw.published : true, // API may omit; assume true for public route
    phone: raw.phone ?? null,
    whatsapp: raw.whatsapp ?? null,
    bio: raw.bio ?? null,
  };
}

async function getProvider(slug: string): Promise<Provider | null> {
  // Primary: Supabase public read (published=true)
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("Providers")
      .select("id, display_name, slug, category, location, published, phone, whatsapp, bio")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (!error && data) return normalizeProvider(data);
  } catch (_) {
    // fall through
  }

  // Fallback: internal API (may return `name` instead of `display_name`)
  try {
    const res = await fetch(`${getBaseUrl()}/api/providers/${slug}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const provider = json?.provider ?? json?.data ?? null;
      const norm = normalizeProvider(provider);
      if (norm && norm.published) return norm;
    }
  } catch (_) {}

  return null;
}

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

  const name = coalesceName(provider);
  const title = `${name} • ${provider.category ?? "Services"} | Vyapr`;
  const description =
    (provider.bio && provider.bio.slice(0, 160)) ||
    `Book ${name}${provider.location ? ` in ${provider.location}` : ""} via Vyapr.`;
  const url = `${getBaseUrl()}/book/${provider.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BookPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const provider = await getProvider(slug);

  if (!provider) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">This page isn’t available</h1>
        <p className="mt-2 text-muted-foreground">
          The profile you’re looking for doesn’t exist or isn’t published yet.
        </p>
        <div className="mt-6">
          <Link href="/" className="underline">Go to Vyapr</Link>
        </div>
      </main>
    );
  }

  const name = coalesceName(provider);
  const baseUrl = getBaseUrl();
  const pageUrl = `${baseUrl}/book/${provider.slug}`;
  const waNumber = normalizePhoneForWA(provider.whatsapp ?? provider.phone ?? "");
  const waText = encodeURIComponent(
    `Hi ${name}, I found your Vyapr page (${pageUrl}). I’d like to book a session.`
  );
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null;
  const telHref = provider.phone ? `tel:${provider.phone.replace(/\s+/g, "")}` : null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description: provider.bio ?? undefined,
    url: pageUrl,
    telephone: provider.phone ?? undefined,
    address: provider.location ? { "@type": "PostalAddress", addressLocality: provider.location } : undefined,
    sameAs: waHref ? [waHref] : undefined,
    potentialAction: waHref ? { "@type": "ReserveAction", target: waHref } : undefined,
  };

  return (
    <main className="mx-auto max-w-xl p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
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

      <footer className="mt-8 text-center text-xs text-muted-foreground">Powered by Vyapr</footer>
    </main>
  );
}
