// @ts-nocheck
// app/directory/template.tsx
import React from "react";
import DirectorySitemapSeo from "@/components/DirectorySitemapSeo";

// Force dynamic so the JSON-LD is always rendered fresh (no stale SSG/ISR)
export const dynamic = "force-dynamic";

export default function DirectoryTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return (
    <>
      {children}
      {/* Inject BreadcrumbList + ItemList derived from sitemap.xml */}
      <DirectorySitemapSeo baseUrl={baseUrl} />
    </>
  );
}
