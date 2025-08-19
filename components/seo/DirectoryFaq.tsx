// components/seo/DirectoryFaq.tsx
// Server component: renders visible FAQs + injects FAQPage JSON-LD.

import React from "react";
import { faqJsonLd, generateDirectoryFaq, toTitle } from "@/lib/seo/faq";

type Props = {
  category: string;         // e.g., "yoga"
  city: string;             // e.g., "delhi"
  providerCount?: number;   // optional
  acceptsWalkIns?: boolean; // optional
  className?: string;
};

export default async function DirectoryFaq(props: Props) {
  const { category, city, providerCount, acceptsWalkIns, className } = props;

  const items = generateDirectoryFaq({
    category,
    city,
    providerCount,
    acceptsWalkIns,
  });

  const json = faqJsonLd(items);
  const heading =
    `${toTitle(category)} in ${toTitle(city)} — Frequently Asked Questions`;

  return (
    <section className={className ?? "mx-auto max-w-3xl px-4 py-8"}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: json }}
      />
      <h2 className="text-2xl font-semibold mb-4">{heading}</h2>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <details
            key={idx}
            className="rounded-2xl border border-gray-200 p-4 open:shadow-sm"
          >
            <summary className="cursor-pointer text-base font-medium">
              {it.question}
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-gray-700">
              {it.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
