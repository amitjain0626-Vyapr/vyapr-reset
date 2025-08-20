// @ts-nocheck
// components/FAQ.tsx
import React from "react";

type FAQ = { question?: string | null; answer?: string | null };
type Props = { items?: FAQ[] | null; className?: string };

export default function FAQ({ items, className = "" }: Props) {
  const faqs = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!faqs.length) return null;

  return (
    <section aria-labelledby="faq-heading" className={className}>
      <h2 id="faq-heading" className="text-lg font-semibold mb-2">
        FAQs
      </h2>
      <div className="space-y-2">
        {faqs.map((f, idx) => {
          const q = (f?.question ?? "").toString().trim();
          const a = (f?.answer ?? "").toString().trim();
          if (!q && !a) return null; // fail-open: skip empty pair
          return (
            <details key={idx} className="rounded-lg border p-3">
              <summary className="cursor-pointer font-medium">
                {q || "Question"}
              </summary>
              {a ? <div className="mt-2 text-sm leading-6">{a}</div> : null}
            </details>
          );
        })}
      </div>
    </section>
  );
}
