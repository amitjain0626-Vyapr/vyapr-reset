// app/directory/[combo]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import T from "@/components/i18n/T";
import { generateDirectoryFaq, faqJsonLd } from "@/lib/seo/faq";
import ProviderCard from "@/components/directory/ProviderCard";

/** ---- SEO: dynamic metadata for OG/Twitter/Title/Description ---- */
export async function generateMetadata({ params }: { params: Promise<{ combo: string }> }) {
  const { combo } = await params;
  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  const [rawCat = "", rawCity = ""] = String(combo || "").split("-");
  const titleCat = unslugify(rawCat);
  const titleCity = unslugify(rawCity);

  const pageTitle = `${titleCat} in ${titleCity} | Vyapr Directory`;
  const description =
    `Find verified ${titleCat} in ${titleCity}. View hours, prices, WhatsApp, and book online. ` +
    `Discover trusted local providers on Vyapr.`;

  const canonical = `${site}/directory/${encodeURIComponent(String(combo || ""))}`;
  const ogImage = `${site}/og/default-provider.svg`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      siteName: "Vyapr",
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "Vyapr — Verified Providers" }],
    },
    twitter: { card: "summary_large_image", title: pageTitle, description, images: [ogImage] },
    robots: { index: true, follow: true, "max-image-preview": "large" },
  };
}

export default async function DirectoryComboPage({ params }: { params: Promise<{ combo: string }> }) {
  const { combo } = await params;
  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  const [rawCat = "", rawCity = ""] = String(combo || "").split("-");
  const titleCat = unslugify(rawCat);
  const titleCity = unslugify(rawCity);
  const pageTitle = `${titleCat} in ${titleCity}`;

  const url = `${site}/api/directory/list?cat=${encodeURIComponent(rawCat)}&loc=${encodeURIComponent(rawCity)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  const providers = Array.isArray(json?.providers) ? json.providers : [];

  const breadcrumbJsonLd = getBreadcrumbJsonLd({ site, combo: String(combo || ""), titleCat, titleCity });
  const itemListJsonLd = getItemListJsonLd({ site, providers });

  /* === VYAPR: Directory JSON-LD START (22.19) === */
  const localBusinessJsonLd = getLocalBusinessGraphJsonLd({
    site,
    providers,
    category: titleCat,
    city: titleCity,
  });
  /* === VYAPR: Directory JSON-LD END (22.19) === */

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-end"><LanguageToggle /></div>

      {/* breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6 mt-3">
        <ol className="flex gap-2 text-gray-600">
          <li><Link href="/" className="hover:underline"><T en="Home" hi="Home" /></Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/directory" className="hover:underline"><T en="Directory" hi="Directory" /></Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium"><T en={pageTitle} hi={pageTitle} /></li>
        </ol>
      </nav>

      {/* SEO JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {providers.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      ) : null}

      {/* LocalBusiness graph */}
      {providers.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      ) : null}

      <h1 className="text-2xl md:text-3xl font-semibold mb-2"><T en={pageTitle} hi={pageTitle} /></h1>
      <p className="text-gray-600 mb-8">
        <T en="Published providers only. Boosted providers appear first." hi="Sirf published providers dikhte hain. Boosted providers sabse upar." />
      </p>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.length > 0 ? (
          providers.map((p: any) => (
            <div key={p.slug} className="relative">
              {p?.verified ? (
                <span className="absolute -top-2 -left-2 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow" aria-label="Verified by Vyapr">
                  Verified by Vyapr
                </span>
              ) : null}
              {/* Boosted badge */}
              {p?.boosted ? (
                <span className="absolute -top-2 -right-2 z-10 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white shadow" aria-label="Boosted" title="Boosted placement">
                  Boosted
                </span>
              ) : null}
              <ProviderCard {...p} />
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-gray-600">
            <T en={`No published providers yet for ${pageTitle}. Check back soon.`} hi={`${pageTitle} ke liye abhi providers listed nahi hain. Jaldi wapas check kijiye.`} />
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-700">
            Looking for more options in <strong>{titleCity}</strong>? Explore our{" "}
            <Link href="/directory" className="underline">Vyapr Directory</Link> or go back to{" "}
            <Link href="/" className="underline">Home</Link>.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">
          <T en={`FAQs about ${titleCat} in ${titleCity}`} hi={`${titleCity} mein ${titleCat} — FAQs`} />
        </h2>
        <p className="text-sm text-gray-600 mb-4"><T en="Short answers to common questions." hi="Chhote aur seedhe jawaab." /></p>
        {(() => {
          const faqItems = generateDirectoryFaq({ category: titleCat, city: titleCity, providerCount: providers.length });
          return (
            <>
              <div className="space-y-4">
                {faqItems.map((it, i) => (
                  <details key={i} className="rounded-xl border p-4">
                    <summary className="cursor-pointer font-medium">{it.question}</summary>
                    <p className="mt-2 text-sm text-gray-700">{it.answer}</p>
                  </details>
                ))}
              </div>
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(faqItems) }} />
            </>
          );
        })()}
      </section>
    </main>
  );
}

/** Utilities */
function unslugify(s: string) {
  const t = String(s || "").replace(/-/g, " ").trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : "";
}

function getBreadcrumbJsonLd({ site, combo, titleCat, titleCity }: { site: string; combo: string; titleCat: string; titleCity: string }) {
  const current = `${titleCat} in ${titleCity}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${site}/` },
      { "@type": "ListItem", "position": 2, "name": "Directory", "item": `${site}/directory` },
      { "@type": "ListItem", "position": 3, "name": current, "item": `${site}/directory/${encodeURIComponent(combo)}` },
    ],
  };
}

function getItemListJsonLd({ site, providers }: { site: string; providers: Array<{ slug?: string; display_name?: string; name?: string }> }) {
  const items = (providers || []).slice(0, 30).map((p, idx) => ({
    "@type": "ListItem",
    "position": idx + 1,
    "url": `${site}/book/${encodeURIComponent(p.slug || "")}`,
    "name": p.display_name || p.name || p.slug || `Provider ${idx + 1}`,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListOrder": "http://schema.org/ItemListOrderAscending",
    "name": "Vyapr Directory Results",
    "itemListElement": items,
  };
}

/* === VYAPR: LocalBusiness graph JSON-LD helper START (22.19) === */
function getLocalBusinessGraphJsonLd({
  site,
  providers,
  category,
  city,
}: {
  site: string;
  providers: Array<any>;
  category: string;
  city: string;
}) {
  const graph = (providers || []).slice(0, 30).map((p: any, idx: number) => {
    const name = p.display_name || p.name || p.slug || `Provider ${idx + 1}`;
    const url = `${site}/book/${encodeURIComponent(p.slug || "")}`;
    const telephone = typeof p.phone === "string" ? p.phone : undefined;

    const node: any = {
      "@type": "LocalBusiness",
      "@id": `${url}#org`,
      "name": name,
      "url": url,
      "areaServed": { "@type": "City", "name": city },
      "knowsAbout": category,
    };

    if (telephone) node.telephone = telephone;

    // === INSERT: openingHours (if present) ===
    // Accepts any of: p.openingHours (array), p.opening_hours (array), p.hours (string)
    const oh = Array.isArray(p?.openingHours) ? p.openingHours
            : Array.isArray(p?.opening_hours) ? p.opening_hours
            : typeof p?.hours === "string" ? [p.hours] : null;
    if (oh && oh.length) node.openingHours = oh.slice(0, 14); // schema allows multiple strings like "Mo-Fr 10:00-18:00"

    // === INSERT: sameAs (if present) ===
    // Accepts arrays/strings from common fields; filters to http(s) URLs
    const rawLinks = []
      .concat(Array.isArray(p?.sameAs) ? p.sameAs : [])
      .concat(Array.isArray(p?.links) ? p.links : [])
      .concat(Array.isArray(p?.socials) ? p.socials : [])
      .concat(typeof p?.website === "string" ? [p.website] : [])
      .concat(typeof p?.facebook === "string" ? [p.facebook] : [])
      .concat(typeof p?.instagram === "string" ? [p.instagram] : [])
      .concat(typeof p?.twitter === "string" ? [p.twitter] : []);
    const sameAs = rawLinks.filter((u: any) => typeof u === "string" && /^https?:\/\//i.test(u));
    if (sameAs.length) node.sameAs = Array.from(new Set(sameAs)).slice(0, 10);

    // Flags via additionalProperty — safe & non-disruptive
    const extra: any[] = [];
    if (p?.verified) extra.push({ "@type": "PropertyValue", "name": "verified", "value": true });
    if (p?.boosted)  extra.push({ "@type": "PropertyValue", "name": "boosted", "value": true });
    if (extra.length) node.additionalProperty = extra;

    return node;
  });

  return { "@context": "https://schema.org", "@graph": graph };
}
/* === VYAPR: LocalBusiness graph JSON-LD helper END (22.19) === */
