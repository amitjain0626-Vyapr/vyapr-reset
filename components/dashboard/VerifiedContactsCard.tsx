// components/dashboard/VerifiedContactsCard.tsx
// @ts-nocheck
"use client";

import { useState, useMemo } from "react";

type VerifiedItem = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string | null;
  score: number;
  tier: "auto" | "review" | "low" | string;
  reasons: string[];
};

export default function VerifiedContactsCard({
  slug,
  items,
}: {
  slug: string;
  items: VerifiedItem[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setOpen((s) => ({ ...s, [id]: !s[id] }));

  const sorted = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    arr.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
    return arr;
  }, [items]);

  return (
    <section
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      data-test="verified-card"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Verified Patients</h2>
          <p className="text-xs text-gray-500">
            Clean list with quick trust hints. Click “Why?” to see reasons.
          </p>
        </div>
        <span className="text-xs text-gray-500">
          {sorted.length} shown
        </span>
      </div>

      <div className="mt-4 divide-y">
        {sorted.length === 0 ? (
          <div className="py-8 text-sm text-gray-500">
            No verified contacts yet. As soon as someone books or pays,
            they’ll appear here.
          </div>
        ) : (
          sorted.map((it) => (
            <article
              key={it.id}
              className="py-3 flex items-start justify-between gap-4"
              data-test="verified-row"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {it.name || it.phone || "Unknown"}
                  </span>
                  <Badge tier={it.tier} />
                  <ScorePill score={it.score} />
                </div>
                <div className="mt-0.5 text-xs text-gray-500 truncate">
                  {it.phone || "—"} {it.email ? `· ${it.email}` : ""}
                </div>

                {open[it.id] && (
                  <ul
                    className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1"
                    data-test="reasons-list"
                  >
                    {normalizeReasons(it.reasons).map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => toggle(it.id)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
                  data-test="toggle-why"
                  aria-expanded={!!open[it.id]}
                >
                  {open[it.id] ? "Hide" : "Why?"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Badge({ tier }: { tier: string }) {
  const label =
    tier === "auto" ? "Auto" :
    tier === "review" ? "Review" :
    "Low";
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]">
      {label}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">
      {score}
    </span>
  );
}

function normalizeReasons(raw: string[] | undefined): string[] {
  const map: Record<string, string> = {
    valid_phone_india_like: "Valid mobile number",
    has_email: "Email present",
    "recent_record_<=180d": "Recent record (≤ 180 days)",
    "recent_record_<=365d": "Recent record (≤ 365 days)",
    events_payment_or_booking_present: "Made a payment or booking",
    event_lead_imported_present: "Imported contact",
    tg_boost_applied: "Category match (extra confidence)",
  };
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => map[k] || k);
}
