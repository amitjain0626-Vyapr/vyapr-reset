// components/seo/ProviderBreadcrumbs.tsx
// Visible breadcrumbs + JSON-LD for provider pages.

import React from "react";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/breadcrumbs";

type Props = {
  providerName: string;          // e.g., "Dr. Kapoor"
  directorySlug?: string | null; // e.g., "/directory/dentist-delhi" (optional)
  className?: string;
};

export default function ProviderBreadcrumbs({
  providerName,
  directorySlug,
  className,
}: Props) {
  const items: Crumb[] = [
    { name: "Home", url: "/" },
    ...(directorySlug ? [{ name: "Directory", url: directorySlug }] : []),
    { name: providerName }, // current page
  ];

  const json = breadcrumbJsonLd(items);

  return (
    <nav
      aria-label="Breadcrumb"
      className={className ?? "text-sm text-gray-600 mb-4"}
    >
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: json }}
      />
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="inline-flex items-center">
              {c.url && !isLast ? (
                <a href={c.url} className="hover:underline hover:text-gray-900">
                  {c.name}
                </a>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="font-medium"
                >
                  {c.name}
                </span>
              )}
              {!isLast && <span className="mx-2 text-gray-400">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
