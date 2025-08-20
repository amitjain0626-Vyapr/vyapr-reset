// @ts-nocheck
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Provider = {
  id?: string;
  name?: string | null;
  slug: string;
  category?: string | null;
  location?: string | null;
  opening_hours?: any;
  address_line1?: string | null;
  address_line2?: string | null;
  pincode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  price_range?: string | null;
  faqs?: any;
  bio?: string | null;
  whatsapp?: string | null;
};

async function getProvider(slug: string): Promise<Provider | null> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim().length > 0
      ? process.env.NEXT_PUBLIC_BASE_URL
      : "";
  const url = `${base}/api/providers/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.provider ?? null;
  } catch {
    return null;
  }
}

/** tolerant helpers **/
function toNumber(n: any): number | undefined {
  if (n === null || n === undefined) return undefined;
  const parsed = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseJSONLoose<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === "object") return v as T;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function normalizeFaqs(faqsRaw: any): Array<{ q: string; a: string }> | undefined {
  const faqs = parseJSONLoose(faqsRaw) ?? faqsRaw;
  if (!faqs || !Array.isArray(faqs)) return undefined;
  const cleaned = faqs
    .map((x: any) => ({
      q: (x?.q ?? x?.question ?? "").toString().trim(),
      a: (x?.a ?? x?.answer ?? "").toString().trim(),
    }))
    .filter((x: any) => x.q && x.a);
  return cleaned.length ? cleaned : undefined;
}

function buildFaqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** SEO **/
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const provider = await getProvider(params.slug);
  if (!provider) return {};
  const title = provider?.name ? `${provider.name} — Book on Vyapr` : `Book ${provider.slug} — Vyapr`;
  const description =
    provider?.bio ??
    `Book an appointment with ${provider?.name ?? provider?.slug}. View hours, address, and FAQs.`;
  return {
    title,
    description,
    alternates: { canonical: `/book/${provider.slug}` },
    openGraph: { title, description, url: `/book/${provider.slug}`, type: "website" },
  };
}

/** PAGE **/
export default async function Page({ params }: { params: { slug: string } }) {
  const provider = await getProvider(params.slug);
  if (!provider) notFound();

  const faqs = normalizeFaqs(provider?.faqs);

  const showAddressLine =
    provider?.address_line1 || provider?.address_line2 || provider?.location || provider?.pincode;
  const lat = toNumber(provider?.latitude);
  const lng = toNumber(provider?.longitude);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{provider?.name || provider.slug}</h1>
        {provider?.category ? <p className="text-sm text-gray-600">{provider.category}</p> : null}
        <div className="text-sm text-gray-600">
          <Link href="/directory" className="underline">← Back to directory</Link>
        </div>
      </header>

      {/* Quick facts (UI only) */}
      <section className="grid grid-cols-1 gap-3 text-sm">
        {provider?.price_range ? (
          <div><span className="font-medium">Price range:</span> {provider.price_range}</div>
        ) : null}

        {showAddressLine ? (
          <div className="space-y-0.5">
            <div className="font-medium">Address</div>
            {provider?.address_line1 ? <div>{provider.address_line1}</div> : null}
            {provider?.address_line2 ? <div>{provider.address_line2}</div> : null}
            {(provider?.location || provider?.pincode) ? (
              <div>{[provider?.location, provider?.pincode].filter(Boolean).join(" — ")}</div>
            ) : null}
          </div>
        ) : null}

        {lat !== undefined && lng !== undefined ? (
          <div>
            <span className="font-medium">Geo:</span>{" "}
            <span className="tabular-nums">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
          </div>
        ) : null}
      </section>

      {/* Opening hours (UI only for now) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <div className="rounded-lg border p-3">
          {renderOpeningHoursList(provider?.opening_hours)}
        </div>
      </section>

      {/* FAQs (UI + JSON-LD below only if exists) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">FAQs</h2>
        {faqs && faqs.length ? (
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <details key={i} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{f.a}</div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No FAQs yet.</p>
        )}
      </section>

      {/* Only add FAQPage JSON-LD (Breadcrumbs + LocalBusiness are handled elsewhere) */}
      {faqs && faqs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faqs)) }}
        />
      ) : null}
    </div>
  );
}

/** Opening hours renderer (tolerant) **/
function renderOpeningHoursList(opening_hours: any) {
  const parsed = parseJSONLoose(opening_hours) ?? opening_hours;

  if (Array.isArray(parsed) && parsed.length) {
    const rows = parsed
      .filter((r: any) => r?.day && (r?.opens || r?.closes))
      .map((r: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between text-sm py-1">
          <span className="text-gray-700">{r.day}</span>
          <span className="tabular-nums">
            {r.opens && r.closes ? `${r.opens} – ${r.closes}` : r.opens || r.closes || ""}
          </span>
        </div>
      ));
    if (rows.length) return <div className="divide-y">{rows}</div>;
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed) as Array<[string, any]>;
    const rows = entries
      .map(([day, v], idx) => {
        const opens = v?.opens ?? (Array.isArray(v) ? v[0]?.opens : undefined);
        const closes = v?.closes ?? (Array.isArray(v) ? v[0]?.closes : undefined);
        if (!day || (!opens && !closes)) return null;
        return (
          <div key={idx} className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-700">{day}</span>
            <span className="tabular-nums">
              {opens && closes ? `${opens} – ${closes}` : opens || closes || ""}
            </span>
          </div>
        );
      })
      .filter(Boolean);
    if (rows.length) return <div className="divide-y">{rows}</div>;
  }

  if (typeof opening_hours === "string" && opening_hours.trim().length) {
    return <div className="text-sm text-gray-700 whitespace-pre-wrap">{opening_hours}</div>;
  }

  return <div className="text-sm text-gray-500">Hours not available.</div>;
}
