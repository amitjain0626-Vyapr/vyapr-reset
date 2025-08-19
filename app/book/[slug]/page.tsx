// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Provider = {
  id: string;
  display_name?: string | null;
  name?: string | null;       // API may use this field
  slug: string;
  category?: string | null;
  location?: string | null;
  published?: boolean | null;
  phone?: string | null;
  whatsapp?: string | null;
  bio?: string | null;
};

// ---- helpers ----
function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (envUrl) {
    const hasProto = /^https?:\/\//i.test(envUrl);
    return hasProto ? envUrl : `https://${envUrl}`;
  }
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

function normalizeProvider(raw: any): Provider | null {
  if (!raw) return null;
  return {
    id: raw.id,
    display_name: raw.display_name ?? raw.name ?? null,
    name: raw.name ?? null,
    slug: raw.slug,
    category: raw.category ?? null,
    location: raw.location ?? null,
    // If API omits `published`, assume it's public because this page is public by design
    published: typeof raw.published === "boolean" ? raw.published : true,
    phone: raw.phone ?? null,
    whatsapp: raw.whatsapp ?? null,
    bio: raw.bio ?? null,
  };
}

async function getProviderBySlug(slug: string): Promise<Provider | null> {
  // 1) Try Supabase (public SELECT where published=true)
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("Providers")
      .select("id, display_name, slug, category, location, published, phone, whatsapp, bio")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (!error && data) return normalizeProvider(data);
  } catch (_) {}

  // 2) Fallback to internal API (absolute URL to avoid relative-fetch issues)
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/providers/${slug}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const provider = json?.provider ?? json?.data ?? null;
      const norm = normalizeProvider(provider);
      if (norm && norm.published) return norm;
    }
  } catch (_) {}

  return null;
}

// ---- metadata ----
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);

  // Coalesce name from provider OR slug param (hard fallback)
  const name =
    (provider?.display_name?.trim() ||
      provider?.name?.trim() ||
      titleFromSlug(slug));

  if (!provider) {
    return {
      title: `${name} • Vyapr`,
      description: "This profile is not published or does not exist.",
      robots: { index: false, follow: false },
    };
  }

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

// ---- page ----
export default async function BookPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);

  // Compute name with a hard fallback to slug TitleCase to avoid "Provider"
  const name =
    (provider?.display_name?.trim() ||
      provider?.name?.trim() ||
      titleFromSlug(slug));

  if (!provider) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="mt-2 text-muted-foreground">
          The profile you’re looking for doesn’t exist or isn’t published yet.
        </p>
        <div className="mt-6">
          <Link href="/" className="underline">Go to Vyapr</Link>
        </div>
      </main>
    );
  }

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
