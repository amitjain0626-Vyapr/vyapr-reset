// @ts-nocheck
// lib/schema.ts
import { normalizeHours } from "./hours";

/**
 * Pure builders for JSON-LD objects.
 * Fail-open: accept partial/missing fields and only include what's present.
 */

export function buildBreadcrumbs(baseUrl: string, segments: { name: string; url?: string }[]) {
  const itemListElement = (segments || [])
    .filter(s => s?.name)
    .map((s, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: s.name,
      item: s.url ? absUrl(baseUrl, s.url) : undefined,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

export function buildFaqPage(faqs?: Array<{ question?: string; answer?: string }>) {
  const items = Array.isArray(faqs) ? faqs : [];
  if (!items.length) return null;

  const mainEntity = items
    .filter(Boolean)
    .map((f) => {
      const q = (f?.question ?? "").toString().trim();
      const a = (f?.answer ?? "").toString().trim();
      if (!q && !a) return null;
      return {
        "@type": "Question",
        name: q || "Question",
        acceptedAnswer: a ? { "@type": "Answer", text: a } : undefined,
      };
    })
    .filter(Boolean);

  if (!mainEntity.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export function buildLocalBusiness(baseUrl: string, provider: any) {
  const {
    slug,
    display_name,
    name,
    category,
    telephone,
    phone,
    website,
    address,
    geo,
    price_range,
    opening_hours,
  } = provider || {};

  // Normalize hours (both UI + schema; UI used by page, schema returned here)
  const { openingHoursSpecification } = normalizeHours(opening_hours);

  const obj: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: display_name || name || slug || "Provider",
    url: slug ? absUrl(baseUrl, `/book/${slug}`) : undefined,
    image: provider?.image || undefined,
    telephone: telephone || phone || undefined,
    priceRange: price_range || undefined,
    address: buildPostalAddress(address),
    geo: buildGeo(geo),
    openingHoursSpecification: openingHoursSpecification?.length ? openingHoursSpecification : undefined,
    sameAs: Array.isArray(provider?.same_as) && provider.same_as.length ? provider.same_as : undefined,
  };

  // Category → "areaServed" or "knowsAbout" (optional, only if present)
  if (category) {
    obj.knowsAbout = [category];
  }
  if (website) {
    obj.url = website; // prefer user site if provided
  }

  return obj;
}

/** helpers */

function absUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function buildPostalAddress(addr: any) {
  if (!addr || typeof addr !== "object") return undefined;
  const { street, locality, region, postal_code, country } = addr;
  const hasAny = street || locality || region || postal_code || country;
  if (!hasAny) return undefined;

  return {
    "@type": "PostalAddress",
    streetAddress: street || undefined,
    addressLocality: locality || undefined,
    addressRegion: region || undefined,
    postalCode: postal_code || undefined,
    addressCountry: country || "IN",
  };
}

function buildGeo(geo: any) {
  if (!geo || typeof geo !== "object") return undefined;
  const lat = Number(geo.lat ?? geo.latitude);
  const lng = Number(geo.lng ?? geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return {
    "@type": "GeoCoordinates",
    latitude: lat,
    longitude: lng,
  };
}
