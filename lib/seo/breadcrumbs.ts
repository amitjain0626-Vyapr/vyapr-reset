// lib/seo/breadcrumbs.ts
// Helpers to render BreadcrumbList JSON-LD with absolute URLs.

export type Crumb = {
  name: string;
  url?: string | null; // last item can omit URL (current page)
};

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
}

function ensureAbsolute(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${baseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export function breadcrumbJsonLd(items: Crumb[]) {
  const listItems = items.map((it, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: it.name,
    ...(it.url ? { item: ensureAbsolute(it.url) } : {}),
  }));

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: listItems,
  });
}
