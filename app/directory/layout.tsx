// @ts-nocheck
// app/directory/layout.tsx
import React from "react";
import DirectorySitemapSeo from "@/components/DirectorySitemapSeo";

// Force dynamic so schema is always rendered server-side (no stale SSG)
export const dynamic = "force-dynamic";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return (
    <div className="min-h-screen">
      {children}

      {/* Inject BreadcrumbList + ItemList derived from sitemap.xml */}
      <DirectorySitemapSeo baseUrl={baseUrl} />
    </div>
  );
}
