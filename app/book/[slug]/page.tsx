// app/book/[slug]/page.tsx
// @ts-nocheck
import Link from "next/link";

type Provider = {
  id: string;
  slug: string;
  display_name: string | null;
  category: string | null;
  location: string | null;
  whatsapp: string | null;
  phone: string | null;
  bio: string | null;
  published: boolean | null;
};

export const revalidate = 600;

// helpers
function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
function comboPath(category?: string | null, city?: string | null) {
  if (!category || !city) return "/directory";
  return `/directory/${slugify(category)}-${slugify(city)}`;
}
function toTitle(s?: string | null) {
  return (s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
function waLink(raw?: string | null, msg?: string) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}

export const metadata = {
  title: "Provider | Vyapr",
  description:
    "View provider details, message on WhatsApp, and book quickly.",
};

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  // Public read guarded by RLS: published=true only
  const { data, error } = await supabase
    .from("Providers")
    .select(
      "id, slug, display_name, category, location, whatsapp, phone, bio, published"
    )
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  const p: Provider | null = !error && data ? data : null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
  const name = p?.display_name || toTitle(p?.slug) || "Provider";
  const category = p?.category || undefined;
  const city = p?.location || undefined;
  const comboUrl = comboPath(category, city);
  const whats = waLink(p?.whatsapp || p?.phone, `Hi ${name}, I found you on Vyapr and want to book.`);
  const isLive = !!p?.published;

  // JSON-LD — LocalBusiness + Breadcrumbs
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Directory", item: `${baseUrl}/directory` },
      ...(category && city
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: `${toTitle(category)} in ${toTitle(city)}`,
              item: `${baseUrl}${comboUrl}`,
            },
          ]
        : []),
      { "@type": "ListItem", position: 4, name, item: `${baseUrl}/book/${slug}` },
    ],
  };

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: `${baseUrl}/book/${slug}`,
    description: p?.bio || undefined,
    telephone: p?.phone || undefined,
    areaServed: city ? [{ "@type": "City", name: city }] : undefined,
    address: city ? { "@type": "PostalAddress", addressLocality: city } : undefined,
    sameAs: whats ? [whats] : undefined,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* NEW: Back-links to strengthen internal mesh */}
      <nav className="mb-4 text-sm">
        <Link href="/directory" className="text-gray-600 hover:underline">
          ← Back to Directory
        </Link>
        {category && city && (
          <>
            <span className="mx-2 text-gray-400">•</span>
            <Link href={comboUrl} className="text-gray-600 hover:underline">
              {toTitle(category)} in {toTitle(city)}
            </Link>
          </>
        )}
      </nav>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{name}</h1>
      <p className="mt-2 text-gray-600">
        {category ? toTitle(category) : "Service"}{city ? ` • ${toTitle(city)}` : ""}
      </p>

      {/* Primary CTA block */}
      <div className="mt-6 rounded-2xl border p-5">
        {whats ? (
          <a
            href={whats}
            className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 font-medium hover:shadow-sm transition"
          >
            Chat on WhatsApp
          </a>
        ) : (
          <div className="text-sm text-gray-600">
            WhatsApp not available. Use the booking link on the directory page.
          </div>
        )}
        {!isLive && (
          <div className="mt-3 text-xs text-amber-700">
            This profile is in preview. Details may change.
          </div>
        )}
      </div>

      {/* About */}
      {p?.bio && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="mt-2 text-gray-700 whitespace-pre-line">{p.bio}</p>
        </section>
      )}

      {/* Safety fallback if provider missing (fail-open UX, still SEO-safe) */}
      {!p && (
        <div className="mt-8 rounded-2xl border p-6">
          <p className="text-gray-700">
            We couldn’t load this profile right now. Try exploring related providers:
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/directory" className="text-sm underline">
              Browse Directory
            </Link>
          </div>
        </div>
      )}

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
    </main>
  );
}
