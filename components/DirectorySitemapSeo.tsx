// @ts-nocheck
// components/DirectorySitemapSeo.tsx
import React from "react";
import { buildBreadcrumbs } from "@/lib/schema";

// Reads sitemap.xml, extracts provider URLs (/book/*), and emits:
// 1) BreadcrumbList (Home > Directory)
// 2) ItemList with provider URLs
async function getSitemapUrls(baseUrl: string): Promise<string[]> {
  const base = (baseUrl || "").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/sitemap.xml?now=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map((m) => m[1]);
    return urls.filter((u) => /\/book\//.test(u));
  } catch {
    return [];
  }
}

export default async function DirectorySitemapSeo({ baseUrl }: { baseUrl?: string }) {
  const base =
    baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  const providerUrls = await getSitemapUrls(base);

  const breadcrumbs = buildBreadcrumbs(base, [
    { name: "Home", url: "/" },
    { name: "Directory" },
  ]);

  const itemList =
    providerUrls.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: providerUrls.map((u, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: u,
          })),
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      {itemList ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      ) : null}
    </>
  );
}
