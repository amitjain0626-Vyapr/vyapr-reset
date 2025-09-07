// components/dashboard/CampaignsTab.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

type FunnelResp = {
  ok: boolean;
  attribution?: Record<string, number>;
  sent7d?: number;
  opens7d?: number;
};

function within7d(tsMs: number) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return now - Number(tsMs) <= sevenDays;
}

export default function CampaignsTab({ slug }: { slug: string }) {
  const [funnel, setFunnel] = useState<FunnelResp | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [f, e] = await Promise.all([
          fetch(`${SITE}/api/analytics/funnel?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
          fetch(`${SITE}/api/debug/events?limit=500`, { cache: "no-store" }).then(r => r.json()).then(j => Array.isArray(j?.rows) ? j.rows : []).catch(() => []),
        ]);
        if (on) {
          setFunnel(f);
          setRows(e.filter((r: any) => r?.source?.provider_slug === slug || r?.source?.slug === slug));
        }
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [slug]);

  const perKind = useMemo(() => {
    const sent: Record<string, number> = {};
    let opens = 0;
    for (const r of rows) {
      if (!within7d(r?.ts)) continue;
      if (r?.event === "template.sent") {
        const k = r?.source?.kind || "unknown";
        sent[k] = (sent[k] || 0) + 1;
      }
      if (r?.event === "booking.landing.opened" && (r?.source?.campaign === "template-pack" || r?.source?.utm_source === "whatsapp")) {
        opens += 1;
      }
    }
    const kinds: Array<{ kind: string; sent7d: number; opens7d: number; bookingsAttributed: number }> = [];
    const allKinds = new Set<string>(["offer","rebook_post","thankyou_post","new_patient","no_show", ...Object.keys(sent || {}), ...Object.keys(funnel?.attribution || {})]);
    for (const k of allKinds) {
      kinds.push({
        kind: k,
        sent7d: sent[k] || 0,
        opens7d: opens, // proxy shared across all template kinds
        bookingsAttributed: funnel?.attribution?.[k] || 0,
      });
    }
    return kinds.sort((a,b)=> (b.bookingsAttributed - a.bookingsAttributed) || (b.opens7d - a.opens7d) || (b.sent7d - a.sent7d));
  }, [rows, funnel]);

  if (loading) return <div className="rounded-2xl border bg-white p-5">Loading campaigns…</div>;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white p-5">
        <div className="text-xs text-gray-500">Campaigns (7 days)</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {perKind.map((x) => (
            <div key={x.kind} className="rounded-xl border p-4 bg-white">
              <div className="text-sm font-semibold">{x.kind.replace(/_/g," ")}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                <span className="rounded-full border px-2 py-1 bg-white">7d Sends: <b>{x.sent7d}</b></span>
                <span className="rounded-full border px-2 py-1 bg-white">7d Opens (proxy): <b>{x.opens7d}</b></span>
                <span className="rounded-full border px-2 py-1 bg-white">Bookings: <b>{x.bookingsAttributed}</b></span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-gray-500">
          Opens are proxied from WhatsApp/template traffic; bookings attribution appears when bookings start carrying <code>source.kind</code>.
        </div>
      </div>
    </section>
  );
}
