// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

type Funnel = {
  ok: boolean;
  leads: number;
  bookings: number;
  paid: number;
  conv_lead_to_book_pct: number;
  conv_book_to_paid_pct: number;
  conv_lead_to_paid_pct: number;
  attribution?: Record<string, number>;
};

export default function FunnelCard({ slug }: { slug: string }) {
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch(`${SITE}/api/analytics/funnel?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const j = await r.json();
        if (on) setData(j);
      } catch {
        if (on) setData(null);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [slug]);

  if (loading) {
    return <div className="rounded-2xl border bg-white p-5">Loading funnel…</div>;
  }
  if (!data?.ok) {
    return <div className="rounded-2xl border bg-white p-5">Could not load funnel.</div>;
  }

  const { leads, bookings, paid, conv_lead_to_book_pct, conv_book_to_paid_pct, conv_lead_to_paid_pct, attribution } = data;

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="text-xs text-gray-500">Funnel</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-lg font-semibold">{leads}</div><div className="text-[11px] text-gray-500">Leads</div></div>
        <div><div className="text-lg font-semibold">{bookings}</div><div className="text-[11px] text-gray-500">Bookings</div></div>
        <div><div className="text-lg font-semibold">{paid}</div><div className="text-[11px] text-gray-500">Paid</div></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="text-xs text-gray-700">{conv_lead_to_book_pct}% L→B</div>
        <div className="text-xs text-gray-700">{conv_book_to_paid_pct}% B→P</div>
        <div className="text-xs text-gray-700">{conv_lead_to_paid_pct}% L→P</div>
      </div>

      {attribution && Object.keys(attribution).length > 0 && (
        <div className="mt-4 text-xs text-gray-600">
          <div className="font-semibold mb-1">Campaign attribution</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(attribution).map(([k, v]) => (
              <span key={k} className="rounded-full border px-2 py-1 bg-white">{k}: <b>{v}</b></span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <a
          href={`${SITE}/api/analytics/funnel?slug=${encodeURIComponent(slug)}`}
          className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs hover:shadow-sm"
          target="_blank" rel="noopener"
        >
          View funnel (JSON)
        </a>
      </div>
    </div>
  );
}
