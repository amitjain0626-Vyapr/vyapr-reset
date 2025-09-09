// components/seo/OrgJsonLd.tsx
// Injects Organization JSON-LD on pages.

import React from "react";
import { BRAND, absUrl } from "@/lib/brand";

type Props = {
  name?: string;
  logoPath?: string;       // e.g., "/logo.png" in /public
  sameAs?: string[];       // social links (optional)
};

export default function OrgJsonLd({
  name = BRAND.name,
  logoPath = "/logo.png",
  sameAs = [],
}: Props) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: BRAND.baseUrl,
    logo: absUrl(logoPath),
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
