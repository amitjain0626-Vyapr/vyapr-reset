// components/seo/OrgJsonLd.tsx
// Injects Organization JSON-LD on pages.

import React from "react";

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
}

type Props = {
  name?: string;
  logoPath?: string;       // e.g., "/logo.png" in /public
  sameAs?: string[];       // social links (optional)
};

export default function OrgJsonLd({
  name = "Korekko",
  logoPath = "/logo.png",
  sameAs = [],
}: Props) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: baseUrl(),
    logo: `${baseUrl()}${logoPath}`,
    ...(sameAs.length ? { sameAs } : {}),
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
