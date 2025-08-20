// app/book/[slug]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// -------- helpers --------
const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function slugify(s?: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unslugify(s?: string) {
  const t = String(s || "").replace(/-/g, " ").trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : "";
}

function buildWhatsAppUrl({ phone, whatsapp, display_name, slug }: any) {
  // prefer explicit whatsapp, then phone; fall back to empty (renders disabled)
  const raw = (whatsapp || phone || "").toString().replace(/[^\d+]/g, "");
  if (!raw) return "";
  const msg = encodeURIComponent(
    `Hi${display_name ? " " + display_name : ""}, I'd like to book a slot via Vyapr (${SITE}/book/${slug}).`
  );
  // Support both wa.me and whatsapp://
  return `https://wa.me/${raw.replace(/^\+/, "")}?text=${msg}`;
}

function BreadcrumbsJsonLd({ provider, comboPath }: { provider: any; comboPath?: string }) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Directory", item: `${SITE}/directory` },
  ];
  if (comboPath) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: `${unslugify(provider?.category)} in ${unslugify(provider?.location)}`,
      item: `${SITE}${comboPath}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: provider?.display_name || provider?.slug || "Provider",
      item: `${SITE}/book/${provider?.slug || ""}`,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: provider?.display_name || provider?.slug || "Provider",
      item: `${SITE}/book/${provider?.slug || ""}`,
    });
  }
  const data = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function LocalBusinessJsonLd({ provider, waUrl }: { provider: any; waUrl: string }) {
  const sameAs: string[] = [];
  if (waUrl) sameAs.push(waUrl);

  const address = provider?.location
    ? { "@type": "PostalAddress", addressLocality: provider.location }
    : undefined;

  const data: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider?.display_name || provider?.slug || "Provider",
    description: provider?.bio || undefined,
    telephone: provider?.phone || provider?.whatsapp || undefined,
    url: `${SITE}/book/${provider?.slug || ""}`,
    address,
    sameAs: sameAs.length ? sameAs : undefined,
    image: provider?.image || undefined,
    areaServed: provider?.location || undefined,
    // Provide a ReserveAction / ScheduleAction pointing to the booking page
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/book/${provider?.slug || ""}`,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
      result: { "@type": "Reservation" },
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function prettyCatLoc(cat?: string, loc?: string) {
  const C = (cat || "").trim();
  const L = (loc || "").trim();
  if (C && L) return `${C} — ${L}`;
  return C || L || "";
}

// -------- page --------
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Public Supabase client (RLS: Providers published=true is publicly readable)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch provider by slug. We do NOT 404; we render fail‑open placeholder if not found/unpublished.
  const { data, error } = await supabase
    .from("Providers")
    .select("slug, display_name, bio, phone, whatsapp, category, location, published")
    .eq("slug", slug)
    .maybeSingle();

  // Compute view model
  const provider = data || { slug, display_name: slug, published: false };
  const isPublished = !!provider?.published;
  const waUrl = buildWhatsAppUrl({ ...provider, slug });

  // Back link to combo (only if category+location exist)
  const comboPath =
    provider?.category && provider?.location
      ? `/directory/${slugify(provider.category)}-${slugify(provider.location)}`
      : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Breadcrumbs (UI) */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex gap-2 text-gray-600">
          <li><Link className="hover:underline" href="/">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link className="hover:underline" href="/directory">Directory</Link></li>
          {comboPath ? (
            <>
              <li aria-hidden="true">/</li>
              <li><Link className="hover:underline" href={comboPath}>
                {unslugify(slugify(provider.category))} in {unslugify(slugify(provider.location))}
              </Link></li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium">{provider?.display_name || provider?.slug}</li>
        </ol>
      </nav>

      {/* Back to combo (polish) */}
      {comboPath ? (
        <div className="mb-4">
          <a href={comboPath} className="text-sm underline">
            ← Back to {provider.category} in {provider.location}
          </a>
        </div>
      ) : null}

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">
          {provider?.display_name || provider?.slug}
        </h1>
        <p className="text-gray-600 mt-1">{prettyCatLoc(provider?.category, provider?.location)}</p>

        {!isPublished ? (
          <p className="mt-3 text-sm text-amber-700">
            Preview is blurred. Publish to go live.
          </p>
        ) : null}
      </header>

      {/* Bio */}
      {provider?.bio ? (
        <section className="mb-6">
          <p className="text-gray-800">{provider.bio}</p>
        </section>
      ) : null}

      {/* CTAs */}
      <section className="flex flex-wrap gap-3 mb-10">
        <a
          href={waUrl || "#"}
          aria-disabled={!waUrl}
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
            waUrl ? "border-emerald-600 hover:shadow-sm" : "border-gray-300 opacity-50 cursor-not-allowed"
          }`}
          {...(waUrl ? { target: "_blank", rel: "noopener" } : {})}
        >
          Chat on WhatsApp
        </a>

        {/* Book Now (for now this can point to WA as well or anchor; adjust once the booking form lives) */}
        <a
          href={waUrl || "#"}
          aria-disabled={!waUrl}
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
            waUrl ? "border-gray-800 hover:shadow-sm" : "border-gray-300 opacity-50 cursor-not-allowed"
          }`}
          {...(waUrl ? { target: "_blank", rel: "noopener" } : {})}
        >
          Book now
        </a>
      </section>

      {/* JSON-LD: Breadcrumbs + LocalBusiness */}
      <BreadcrumbsJsonLd provider={provider} comboPath={comboPath} />
      <LocalBusinessJsonLd provider={provider} waUrl={waUrl} />
    </main>
  );
}
