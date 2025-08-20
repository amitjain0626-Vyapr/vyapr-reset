// @ts-nocheck
/**
 * Debug-safe builders for JSON-LD.
 * Fail-open, dedupe, and omit empty optionals.
 * NOTE: Only used by /api/debug/* routes. Public pages are untouched.
 */

type Crumb = { name?: string; url?: string; item?: string };
type TrailInput =
  | Crumb[]
  | { trail?: Crumb[]; segments?: Crumb[]; baseUrl?: string };

export function buildBreadcrumbs(input: TrailInput) {
  const list: Crumb[] = Array.isArray(input)
    ? input
    : Array.isArray((input as any)?.trail)
    ? (input as any).trail
    : Array.isArray((input as any)?.segments)
    ? (input as any).segments
    : [];

  const cleaned = (list || [])
    .filter(Boolean)
    .map((c) => ({
      name: String(c?.name ?? "").trim(),
      item: String(c?.url ?? c?.item ?? "").trim(),
    }))
    .filter((c) => c.name || c.item);

  const itemListElement = cleaned.map((c, i) => {
    const out: any = { "@type": "ListItem", position: i + 1 };
    if (c.name) out.name = c.name;
    if (c.item) out.item = c.item;
    return out;
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

type Address = {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
};

type Geo = { latitude?: number; longitude?: number };

type ProviderLike = {
  name?: string;
  slug?: string;
  url?: string;
  description?: string;
  priceRange?: string;
  telephone?: string;
  sameAs?: string[]; // social links
  image?: string | string[];
  address?: Address;
  geo?: Geo;
  openingHoursSpecification?: any[];
};

export function buildLocalBusiness(input: ProviderLike | { provider?: ProviderLike; baseUrl?: string }) {
  const p: ProviderLike = (input as any)?.provider ?? (input as any) ?? {};
  const out: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
  };

  function assignIf(k: string, v: any) {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    out[k] = v;
  }

  assignIf("name", p.name);
  assignIf("description", p.description);
  assignIf("url", p.url);
  assignIf("telephone", p.telephone);
  assignIf("priceRange", p.priceRange);
  assignIf("sameAs", Array.isArray(p.sameAs) ? p.sameAs.filter(Boolean) : undefined);
  assignIf("image", p.image);

  if (p.address && typeof p.address === "object") {
    const addr: any = { "@type": "PostalAddress" };
    const a = p.address;
    if (a.streetAddress) addr.streetAddress = a.streetAddress;
    if (a.addressLocality) addr.addressLocality = a.addressLocality;
    if (a.addressRegion) addr.addressRegion = a.addressRegion;
    if (a.postalCode) addr.postalCode = a.postalCode;
    if (a.addressCountry) addr.addressCountry = a.addressCountry;
    // only attach if any field present
    if (Object.keys(addr).length > 1) out.address = addr;
  }

  if (p.geo && (p.geo.latitude != null || p.geo.longitude != null)) {
    out.geo = {
      "@type": "GeoCoordinates",
      latitude: p.geo.latitude,
      longitude: p.geo.longitude,
    };
  }

  // Permit either already-normalized specs or pass-through (debug)
  if (Array.isArray(p.openingHoursSpecification)) {
    assignIf("openingHoursSpecification", p.openingHoursSpecification);
  }

  return out;
}

type QA = { question?: string; answer?: string };

export function buildFaqPage(input: QA[] | { items?: QA[] }) {
  const items: QA[] = Array.isArray(input) ? input : (input as any)?.items ?? [];
  const pairs = (items || [])
    .map((x) => ({
      q: String(x?.question ?? "").trim(),
      a: String(x?.answer ?? "").trim(),
    }))
    .filter((x) => x.q && x.a);

  if (pairs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };
}
