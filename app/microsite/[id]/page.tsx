// app/microsite/[id]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

/* ---------- tiny helpers ---------- */
function buildWaUrl({ phone, whatsapp, display_name, slug }: any) {
  const msg = `Hi${display_name ? " " + display_name : ""}, I'd like to book a slot via Korekko (${SITE}/book/${slug}).`;
  const raw = (whatsapp || phone || "").toString().replace(/[^\d+]/g, "");
  return raw
    ? `https://wa.me/${raw.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

async function getVerified(slug: string) {
  try {
    const r = await fetch(`${SITE}/api/verification/status?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = await r.json();
    return !!j?.verified;
  } catch {
    return false;
  }
}

/* ---------- SEO: generateMetadata ---------- */
export async function generateMetadata(props: any) {
  const params = props?.params && typeof props.params.then === "function" ? await props.params : props?.params || {};
  const slug = (params?.id || "").trim();

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await sb
    .from("Providers")
    .select("slug, display_name, bio, category, location, image")
    .eq("slug", slug)
    .maybeSingle();

  const p = data || { slug, display_name: slug, bio: null, image: null };
  const title = `${p?.display_name || p?.slug} — ${p?.category || "Services"}${p?.location ? " in " + p.location : ""}`;
  const description = p?.bio || "Book and pay easily with Korekko.";
  const url = `${SITE}/microsite/${slug}`;
  // V2.3 context — 2 lines above
  // const url = `${SITE}/microsite/${slug}`;
  // const images = p?.image ? [p.image] : undefined;
  // <<insert>>
  /* === INSERT START (22.16: default OG image fallback) === */
  const defaultOg = `${SITE}/og/default-provider.png`;
  const images = [p?.image || defaultOg];
  /* === INSERT END === */

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Korekko", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/* ---------- Page ---------- */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // [id] is provider slug
  const slug = (id || "").trim();

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

  const { data } = await sb
    .from("Providers")
    .select("id, slug, display_name, bio, phone, whatsapp, category, location, services, published, image")
    .eq("slug", slug)
    .maybeSingle();

  const p =
    data || {
      slug,
      display_name: slug,
      bio: null,
      phone: null,
      whatsapp: null,
      category: null,
      location: null,
      services: [],
      published: false,
      image: null,
    };

  const waUrl = buildWaUrl({ ...p, slug });
  const verified = await getVerified(slug);

  // === VYAPR: Verified badge guard (22.15) START ===
  const showVerified = !!verified && !!p?.published;
  // === VYAPR: Verified badge guard (22.15) END ===

  const services: Array<{ name: string; price?: number | string; desc?: string }> = Array.isArray(p?.services)
    ? p.services
    : [];

  const ogUrl = `${SITE}/microsite/${slug}`;
  // V2.3 context — 2 lines above
  // const jsonLd = {
  //   "@context": "https://schema.org",
  //   "@type": "LocalBusiness",
  //   name: p?.display_name || p?.slug,
  //   description: p?.bio || undefined,
  //   telephone: p?.phone || p?.whatsapp || undefined,
  //   url: ogUrl,
  //   image: p?.image || undefined,
  //   address: p?.location ? { "@type": "PostalAddress", addressLocality: p.location } : undefined,
  //   sameAs: waUrl ? [waUrl] : undefined,
  //   potentialAction: {
  //     "@type": "ReserveAction",
  //     target: { "@type": "EntryPoint", urlTemplate: `${SITE}/book/${slug}` },
  //   },
  // };
  // <<insert>>
  /* === INSERT START (22.16: default image in JSON-LD) === */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: p?.display_name || p?.slug,
    description: p?.bio || undefined,
    telephone: p?.phone || p?.whatsapp || undefined,
    url: ogUrl,
    image: p?.image || `${SITE}/og/default-provider.png`,
    address: p?.location ? { "@type": "PostalAddress", addressLocality: p.location } : undefined,
    sameAs: waUrl ? [waUrl] : undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE}/book/${slug}` },
    },
  };
  /* === INSERT END === */

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <main
      className="mx-auto max-w-3xl px-4 py-10 space-y-8"
      data-test="microsite-root"
      data-published={String(!!p?.published)}
      data-verified={String(!!verified)}
      data-slug={slug}
    ></main>
      <Script id="json-ld-microsite" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            {p?.display_name || p?.slug}
            {/* === VYAPR: Verified badge guard (22.15) START === */}
            {showVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Verified by Korekko
              </span>
            ) : null}
            {/* === VYAPR: Verified badge guard (22.15) END === */}
          </h1>
          <p className="text-gray-600 mt-1">{[p?.category, p?.location].filter(Boolean).join(" • ")}</p>
        </div>
        <a href={`/book/${slug}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm">
          Book now
        </a>
      </header>

      {/* Services */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Services</h2>
        {services.length ? (
          <ul className="space-y-3">
            {services.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{s?.name || "Service"}</div>
                  {s?.desc ? <div className="text-sm text-gray-600">{s.desc}</div> : null}
                </div>
                {s?.price ? <div className="text-sm text-gray-800">₹{s.price}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">Provider hasn’t added services yet.</p>
        )}
      </section>

      {/* About */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">About</h2>
        <p className="text-gray-700 text-sm whitespace-pre-line">{p?.bio || "A brief about the provider will appear here."}</p>
      </section>

      {/* Contact */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Contact</h2>
        <div className="flex flex-wrap gap-3">
          <a href={waUrl} target="_blank" rel="noopener" className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-emerald-600 hover:shadow-sm">
            Chat on WhatsApp
          </a>
          <a href={`/book/${slug}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm">
            Book a slot
          </a>
        </div>
      </section>

      {/* Share (QR) */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Share</h2>
        <div className="flex items-center gap-4">
          <img alt="Booking QR" className="w-32 h-32 border rounded-lg" src={`/api/qr?url=${encodeURIComponent(`${SITE}/book/${slug}`)}`} />
          <div className="text-sm text-gray-700">
            Scan to book: <span className="font-mono">{SITE.replace(/^https?:\/\//, "")}/book/{slug}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <a href={`/api/vcard/${encodeURIComponent(slug)}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm hover:shadow-sm">
            📇 Download Digital Card (.vcf)
          </a>
          <a href={`/vcard/${encodeURIComponent(slug)}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm hover:shadow-sm" target="_blank" rel="noopener noreferrer">
            🔗 Open share card
          </a>
        </div>
      </section>

      {/* Breadcrumbs minimal */}
      <nav aria-label="Breadcrumb" className="text-xs text-gray-5 00">
        <ol className="flex gap-2">
          <li>
            <Link className="hover:underline" href="/">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link className="hover:underline" href="/directory">
              Directory
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-800">{p?.display_name || p?.slug}</li>
        </ol>
      </nav>
    </main>
  );
}
