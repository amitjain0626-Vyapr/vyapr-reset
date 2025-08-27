// components/leads/RoiBar.tsx
// @ts-nocheck
"use client";

import * as React from "react";

type Ev = {
  event: string;
  ts: number;
  provider_id?: string | null;
  lead_id?: string | null;
  source?: any;
};

export default function RoiBar({ providerId }: { providerId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<{
    d1: Record<string, number>;
    d7: Record<string, number>;
  } | null>(null);

  React.useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const url = `/api/debug/events?limit=500&_=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "load failed");
        const rows: Ev[] = (json.rows || []).filter(
          (r: any) => r?.provider_id && r.provider_id === providerId
        );

        const now = Date.now();
        const t24 = now - 24 * 60 * 60 * 1000;
        const t7d = now - 7 * 24 * 60 * 60 * 1000;

        function bucket(since: number) {
          const c = {
            reminders: 0,
            rebooks: 0,
            notes: 0,
            leads: 0,
            nudges: 0,
            status: 0,
          };
          for (const r of rows) {
            if (Number(r.ts || 0) < since) continue;
            const e = r.event || "";
            if (e === "wa.reminder.sent") c.reminders++;
            else if (e === "wa.rebook.sent") c.rebooks++;
            else if (e.startsWith("note.")) c.notes++;
            else if (e === "lead.created" || e === "lead.imported") c.leads++;
            else if (e === "nudge.suggested") c.nudges++;
            else if (e === "lead.status.updated") c.status++;
          }
          return c;
        }

        const d1 = bucket(t24);
        const d7 = bucket(t7d);
        if (alive) setData({ d1, d7 });
      } catch (e: any) {
        if (alive) setErr(e?.message || "error");
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [providerId]);

  function Card({
    title,
    d1,
    d7,
  }: {
    title: string;
    d1: number;
    d7: number;
  }) {
    return (
      <div className="rounded-lg border p-3 shadow-sm bg-white">
        <div className="text-xs text-gray-500">{title}</div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className="text-xl font-semibold">{d1}</div>
          <div className="text-xs text-gray-500">/ 24h</div>
          <div className="ml-auto text-sm text-gray-600">7d: {d7}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {err ? (
        <div className="text-sm text-red-600">ROI load failed: {err}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Card title="Reminders" d1={data?.d1.reminders || 0} d7={data?.d7.reminders || 0} />
          <Card title="Rebooks"   d1={data?.d1.rebooks   || 0} d7={data?.d7.rebooks   || 0} />
          <Card title="Notes"     d1={data?.d1.notes     || 0} d7={data?.d7.notes     || 0} />
          <Card title="Leads"     d1={data?.d1.leads     || 0} d7={data?.d7.leads     || 0} />
          <Card title="Nudges"    d1={data?.d1.nudges    || 0} d7={data?.d7.nudges    || 0} />
          <Card title="Status"    d1={data?.d1.status    || 0} d7={data?.d7.status    || 0} />
        </div>
      )}
      {loading ? <div className="text-xs text-gray-500 mt-1">Loading ROI…</div> : null}
    </div>
  );
}
