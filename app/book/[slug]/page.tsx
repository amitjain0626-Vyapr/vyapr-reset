// @ts-nocheck
// app/book/[slug]/page.tsx
import React from "react";
import FAQ from "@/components/FAQ";
import { buildBreadcrumbs, buildFaqPage, buildLocalBusiness } from "@/lib/schema";
import { normalizeHours } from "@/lib/hours";

type PageProps = { params: { slug: string } };

async function getProviderFromApi(baseUrl: string, slug: string) {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/providers/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json().catch(() => ({}));
    return json?.provider ?? {};
  } catch {
    return {};
  }
}

export default async function ProviderPage({ params }: PageProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const slug = params?.slug;
  const provider = await getProviderFromApi(baseUrl, slug);

  const safe = provider ?? {};

  // Hours → UI + Schema
  const { uiList: uiHours } = normalizeHours(safe.opening_hours);

  // JSON-LD builders
  const breadcrumbs = buildBreadcrumbs(baseUrl, [
    { name: "Home", url: "/" },
    { name: "Directory", url: "/directory" },
    { name: safe.display_name || safe.name || slug || "Profile" },
  ]);

  const localBusiness = buildLocalBusiness(baseUrl, { ...safe, slug });
  const faqPage = buildFaqPage(safe.faqs);

  // Always keep a 3rd script: FAQPage (if present) else a unique WebPage fallback
  const fallbackThird = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: (safe.display_name || safe.name || slug || "Profile") + " — Vyapr",
    identifier: `vyapr-9.6-fallback-${slug || "unknown"}`,
  };
  const thirdSchema = faqPage || fallbackThird;

  return (
    <main className="max-w-2xl mx-auto p-4">
      {/* QA marker: comment + data-attr + visible string */}
      {/* VYAPR-9.6 */}
      <div data-vyapr="VYAPR-9.6" className="sr-only">VYAPR-9.6</div>

      <nav className="text-sm mb-4">
        <a href="/" className="underline">Home</a>
        {" / "}
        <a href="/directory" className="underline">Directory</a>
        {" / "}
        <span>{safe.display_name || safe.name || slug}</span>
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold">
          {safe.display_name || safe.name || slug}
        </h1>
        {safe.category ? (
          <p className="text-sm text-gray-600">{safe.category}</p>
        ) : null}
      </header>

      {/* Address */}
      {safe?.address?.street || safe?.address?.locality ? (
        <section className="mb-4">
          <h2 className="text-lg font-semibold">Address</h2>
          <p className="text-sm">
            {[safe.address?.street, safe.address?.locality, safe.address?.region, safe.address?.postal_code]
              .filter(Boolean)
              .join(", ")}
          </p>
        </section>
      ) : null}

      {/* Price range */}
      {safe?.price_range ? (
        <section className="mb-4">
          <h2 className="text-lg font-semibold">Price range</h2>
          <p className="text-sm">{safe.price_range}</p>
        </section>
      ) : null}

      {/* Opening hours */}
      {uiHours?.length ? (
        <section className="mb-4">
          <h2 className="text-lg font-semibold">Opening hours</h2>
          <ul className="text-sm list-disc ml-5">
            {uiHours.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>
      ) : null}

      {/* FAQs */}
      <FAQ items={safe.faqs} className="mb-8" />

      {/* Back link */}
      <p className="mt-6">
        <a className="underline" href="/directory">← Back to directory</a>
      </p>

      {/* JSON-LD scripts — exactly 3 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(thirdSchema) }}
      />
    </main>
  );
}
