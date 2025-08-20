// @ts-nocheck
// app/directory/ping/page.tsx
import React from "react";
import DirectorySitemapSeo from "@/components/DirectorySitemapSeo";

export const dynamic = "force-dynamic";

export default async function DirectoryPingPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold">Directory Ping</h1>
      <p className="text-sm text-gray-600">
        If you can see this, /directory/ping is wired.
      </p>

      {/* Injects BreadcrumbList + ItemList built from sitemap.xml */}
      <DirectorySitemapSeo baseUrl={baseUrl} />
    </main>
  );
}
