// app/api/microsite/[slug]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { BRAND, COPY, absUrl } from "@/lib/brand";

const SITE = BRAND.baseUrl; // centralized (no hard-coded vyapr domain)

function slugify(s?: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildWaUrl({ phone, whatsapp, display_name, slug }: any) {
  const raw = (whatsapp || phone || "").toString().replace(/[^\d+]/g, "");
  if (!raw) return "";
  const msg = encodeURIComponent(
    `Hi${display_name ? " " + display_name : ""}, I'd like to book a slot via ${BRAND.name} (${absUrl(
      `/book/${slug}`
    )}).`
  );
  return `https://wa.me/${raw.replace(/^\+/, "")}?text=${msg}`;
}

async function fetchVerification(slug: string) {
  try {
    const res = await fetch(
      `${SITE}/api/verification/status?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    const j = await res.json();
    return !!j?.verified;
  } catch {
    return false;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: provider } = await sb
    .from("Providers")
    .select(
      "id, slug, display_name, bio, phone, whatsapp, category, location, services, published, image"
    )
    .eq("slug", slug)
    .maybeSingle();

  const p = provider || { slug, display_name: slug, published: false };
  const waUrl = buildWaUrl({ ...p, slug });
  const verified = await fetchVerification(slug);

  const services: Array<{
    name: string;
    price?: number | string;
    desc?: string;
  }> = Array.isArray(p?.services) ? p.services : [];

  const ogTitle = `${p?.display_name || p?.slug} — ${
    p?.category || "Services"
  } in ${p?.location || ""}`.trim();
  const ogDesc = p?.bio || `Book and pay easily with ${BRAND.name}.`;
  const ogUrl = `${SITE}/microsite/${slug}`;

  return (
    <main className="mx-auto max-3xl px-4 py-10 space-y-8">
      {/* Meta for SEO/OG */}
      <head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={ogUrl} />
        {p?.image ? <meta property="og:image" content={p.image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        {/* JSON-LD LocalBusiness */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: p?.display_name || p?.slug,
              description: p?.bio || undefined,
              telephone: p?.phone || p?.whatsapp || undefined,
              url: ogUrl,
              image: p?.image || undefined,
              address: p?.location
                ? { "@type": "PostalAddress", addressLocality: p.location }
                : undefined,
              sameAs: waUrl ? [waUrl] : undefined,
              potentialAction: {
                "@type": "ReserveAction",
                target: { "@type": "EntryPoint", urlTemplate: `${SITE}/book/${slug}` },
              },
            }),
          }}
        />
      </head>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            {p?.display_name || p?.slug}
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                {COPY.verifiedBy}
              </span>
            ) : null}
          </h1>
          <p className="text-gray-600 mt-1">
            {[p?.category, p?.location].filter(Boolean).join(" • ")}
          </p>
        </div>
        <a
          href={`/book/${slug}`}
          className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm"
        >
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
                  <div className="font-medium">{s.name}</div>
                  {s.desc ? (
                    <div className="text-sm text-gray-600">{s.desc}</div>
                  ) : null}
                </div>
                {s.price ? (
                  <div className="text-sm text-gray-800">₹{s.price}</div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">
            Provider hasn’t added services yet.
          </p>
        )}
      </section>

      {/* About */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">About</h2>
        <p className="text-gray-700 text-sm whitespace-pre-line">
          {p?.bio || "A brief about the provider will appear here."}
        </p>
      </section>

      {/* Contact */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Contact</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={waUrl || "#"}
            aria-disabled={!waUrl}
            className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
              waUrl
                ? "border-emerald-600 hover:shadow-sm"
                : "border-gray-300 opacity-50 cursor-not-allowed"
            }`}
            {...(waUrl ? { target: "_blank", rel: "noopener" } : {})}
          >
            Chat on WhatsApp
          </a>
          <a
            href={`/book/${slug}`}
            className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm"
          >
            Book a slot
          </a>
        </div>
      </section>

      {/* Quick QR + Share */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Share</h2>
        <div className="flex items-center gap-4">
          <img
            alt="QR code"
            className="w-32 h-32 border rounded-lg"
            src={`/api/qr?url=${encodeURIComponent(`${SITE}/book/${slug}`)}`}
          />
          <div className="text-sm text-gray-700">
            Scan to book:{" "}
            <span className="font-mono">
              {SITE.replace(/^https?:\/\//, "")}/book/{slug}
            </span>
          </div>
        </div>
      </section>

      {/* Breadcrumbs minimal */}
      <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
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
