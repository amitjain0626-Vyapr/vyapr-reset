// components/leads/RoiBar.tsx
// @ts-nocheck
"use client";

import * as React from "react";

type Ev = {
  event: string;
  ts: number;
  provider_id?: string | null;
};

export default function RoiBar({ providerId }: { providerId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [totals24h, setTotals24h] = React.useState({
    reminders: 0,
    rebooks: 0,
    replies: 0,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/debug/events?limit=500&_=${Date.now()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "load failed");
      const rows: Ev[] = (json.rows || []).filter(
        (r: any) => r?.provider_id === providerId
      );

      const now = Date.now();
      const since = now - 24 * 60 * 60 * 1000;

      let reminders = 0,
        rebooks = 0,
        replies = 0;

      for (const r of rows) {
        if (Number(r.ts || 0) < since) continue;
        const e = r.event || "";
        if (e === "wa.reminder.sent") reminders++;
        else if (e === "wa.rebook.sent") rebooks++;
        else if (e === "note.customer.added") replies++;
      }

      setTotals24h({ reminders, rebooks, replies });
    } catch (e: any) {
      setErr(e?.message || "error");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  React.useEffect(() => {
    load();
  }, [load]);

  function Pill({
    value,
    label,
    hint,
  }: {
    value: number | string;
    label: string;
    hint: string;
  }) {
    return (
      <div className="rounded-xl border bg-white px-3 py-2 shadow-sm flex items-center gap-3">
        <div className="text-2xl font-semibold min-w-[2ch]">{value}</div>
        <div className="leading-tight">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-gray-500">{hint}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs text-gray-500">Last 24 hours</div>
        <button
          onClick={load}
          className="text-xs text-blue-600 hover:underline"
          type="button"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div className="text-sm text-red-600">ROI load failed: {err}</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Pill value={totals24h.reminders} label="Reminders sent" hint="via WhatsApp" />
          <Pill value={totals24h.rebooks} label="Rebooks sent" hint="via WhatsApp" />
          <Pill value={totals24h.replies} label="Customer replies" hint="notes added" />
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-gray-500 mt-1">Updating…</div>
      ) : null}
    </div>
  );
}
