// components/seo/Breadcrumbs.tsx
// Server component: renders visible breadcrumbs + JSON-LD.

import React from "react";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/breadcrumbs";

type Props = {
  items: Crumb[];          // [{ name, url? }, ...] last is current page
  className?: string;
};

export default async function Breadcrumbs({ items, className }: Props) {
  // Normalize: only include non-empty names
  const safe = items.filter((c) => c?.name?.trim().length > 0);
  const json = breadcrumbJsonLd(safe);

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
        {safe.map((c, idx) => {
          const isLast = idx === safe.length - 1;
          return (
            <li key={idx} className="inline-flex items-center">
              {c.url && !isLast ? (
                <a href={c.url} className="hover:underline hover:text-gray-900">
                  {c.name}
                </a>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="font-medium">
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
