// @ts-nocheck
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Types (tolerant) **/
type Provider = {
  id?: string;
  name?: string | null;
  slug: string;
  category?: string | null;
  location?: string | null;
  opening_hours?: any;          // JSON, JSON-string, or text
  address_line1?: string | null;
  address_line2?: string | null;
  pincode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  price_range?: string | null;  // e.g., "₹₹"
  faqs?: any;                   // JSONB or JSON-string: [{q,a}]
  bio?: string | null;
  whatsapp?: string | null;
  url?: string | null;
};

/** Data fetch (fail-open) **/
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

/** helpers (tolerant) **/
function parseJSONLoose(v: any) {
  if (!v) return undefined;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return undefined; }
  }
  return undefined;
}

function toNumber(n: any): number | undefined {
  if (n === null || n === undefined) return undefined;
  const x = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(x) ? x : undefined;
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

function renderOpeningHoursList(opening_hours: any) {
  const parsed = parseJSONLoose(opening_hours) ?? opening_hours;

  if (Array.isArray(parsed) && parsed.length) {
    const rows = parsed
      .filter((r: any) => r?.day && (r?.opens || r?.closes))
      .map((r: any, i: number) => (
        <div key={i} className="flex items-center justify-between text-sm py-1">
          <span className="text-gray-700">{r.day}</span>
          <span className="tabular-nums">
            {r.opens && r.closes ? `${r.opens} – ${r.closes}` : (r.opens || r.closes || "")}
          </span>
        </div>
      ));
    if (rows.length) return <div className="divide-y">{rows}</div>;
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed) as Array<[string, any]>;
    const rows = entries
      .map(([day, v], i) => {
        const opens = v?.opens ?? (Array.isArray(v) ? v[0]?.opens : undefined);
        const closes = v?.closes ?? (Array.isArray(v) ? v[0]?.closes : undefined);
        if (!day || (!opens && !closes)) return null;
        return (
          <div key={i} className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-700">{day}</span>
            <span className="tabular-nums">
              {opens && closes ? `${opens} – ${closes}` : (opens || closes || "")}
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

/** LocalBusiness enrichment builders **/
function buildAddress(provider: Provider) {
  const line1 = provider?.address_line1 ?? null;
  const line2 = provider?.address_line2 ?? null;
  const locality = provider?.location ?? null;
  const postalCode = provider?.pincode ? String(provider.pincode) : null;

  if (!line1 && !line2 && !locality && !postalCode) return undefined;

  const address: any = { "@type": "PostalAddress", addressCountry: "IN" };
  if (line1 || line2) {
    address.streetAddress = [line1, line2].filter(Boolean).join(", ");
  }
  if (locality) address.addressLocality = locality;
  if (postalCode) address.postalCode = postalCode;
  return address;
}

function buildOpeningHoursSpecification(opening_hours: any) {
  const oh = parseJSONLoose(opening_hours) ?? opening_hours;
  const asArray =
    Array.isArray(oh) && oh.length
      ? oh
      : typeof oh === "object" && oh
      ? Object.entries(oh).flatMap(([day, val]: any) => {
          if (!val) return [];
          if (Array.isArray(val)) return val.map((v) => ({ day, opens: v?.opens, closes: v?.closes }));
          return [{ day, opens: val?.opens, closes: val?.closes }];
        })
      : null;

  if (!asArray || !asArray.length) return undefined;

  return asArray
    .filter((row: any) => row?.day && (row?.opens || row?.closes))
    .map((row: any) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: row.day,
      opens: row.opens ?? undefined,
      closes: row.closes ?? undefined,
    }));
}

function buildGeo(provider: Provider) {
  const lat = toNumber(provider?.latitude);
  const lng = toNumber(provider?.longitude);
  if (lat === undefined || lng === undefined) return undefined;
  return { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
}

function buildLocalBusinessSchema(provider: Provider) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const address = buildAddress(provider);
  const hours = buildOpeningHoursSpecification(provider?.opening_hours);
  const geo = buildGeo(provider);
  const priceRange = provider?.price_range ? String(provider.price_range) : undefined;

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider?.name || provider?.slug,
    url: `${base}/book/${provider?.slug}`,
  };

  if (address) schema.address = address;
  if (hours) schema.openingHoursSpecification = hours;
  if (geo) schema.geo = geo;
  if (priceRange) schema.priceRange = priceRange;
  if (provider?.category) schema.department = provider.category;

  return schema;
}

/** FAQPage schema (only when FAQs exist) **/
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

/** PAGE (data-bound UI + JSON-LD: LocalBusiness always, FAQPage only if FAQs exist) **/
export default async function Page({ params }: any) {
  const slug = params?.slug ?? "";
  const provider = await getProvider(slug);

  const faqs = normalizeFaqs(provider?.faqs);
  const lat = toNumber(provider?.latitude);
  const lng = toNumber(provider?.longitude);

  const localBusinessLD = buildLocalBusinessSchema({
    ...(provider ?? {}),
    slug: slug || provider?.slug || "",
  } as Provider);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* marker so we know this build is live */}
      <div className="text-[10px] uppercase tracking-widest text-gray-500">VYAPR-9.5 LBLD</div>

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{provider?.name || slug || "Provider"}</h1>
        {provider?.category ? <p className="text-sm text-gray-600">{provider.category}</p> : null}
        <div className="text-sm text-gray-600">
          <Link href="/directory" className="underline">← Back to directory</Link>
        </div>
      </header>

      {/* Quick facts */}
      <section className="grid grid-cols-1 gap-3 text-sm">
        {provider?.price_range ? (
          <div><span className="font-medium">Price range:</span> {provider.price_range}</div>
        ) : null}

        {(provider?.address_line1 || provider?.address_line2 || provider?.location || provider?.pincode) ? (
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
            <span className="tabular-nums">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
        ) : null}
      </section>

      {/* Opening hours */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <div className="rounded-lg border p-3">
          {renderOpeningHoursList(provider?.opening_hours)}
        </div>
      </section>

      {/* FAQs */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">FAQs</h2>
        {faqs?.length ? (
          <div className="space-y-2">
            {faqs!.map((f, i) => (
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

      {/* JSON-LD: LocalBusiness always; FAQPage only if FAQs exist */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLD) }}
      />
      {faqs?.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faqs)) }}
        />
      ) : null}
    </div>
  );
}
