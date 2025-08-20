// @ts-nocheck
// components/SeoBreadcrumbs.tsx
import React from "react";
import { buildBreadcrumbs } from "@/lib/schema";

type Crumb = { name: string; url?: string };
type Props = {
  baseUrl?: string;
  trail: Crumb[]; // e.g., [{ name: "Home", url: "/" }, { name: "Directory" }]
  className?: string;
};

export default function SeoBreadcrumbs({ baseUrl, trail, className = "" }: Props) {
  const _base =
    baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const data = buildBreadcrumbs(_base, trail);

  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      {/* Visual trail */}
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {c.url ? (
              <a href={c.url} className="underline">
                {c.name}
              </a>
            ) : (
              <span>{c.name}</span>
            )}
            {i < trail.length - 1 ? <span>/</span> : null}
          </li>
        ))}
      </ol>

      {/* JSON-LD for Breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    </nav>
  );
}
