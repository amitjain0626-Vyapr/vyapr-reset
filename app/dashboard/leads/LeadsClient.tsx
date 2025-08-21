// app/dashboard/leads/LeadsClient.tsx
"use client";
// @ts-nocheck
import { useEffect, useState } from "react";

type LeadRow = {
  id: string; created_at: string; patient_name: string | null; phone: string | null;
  note: string | null; provider_id: string; source: any | null;
};

function UtmChip({ source }: { source: any }) {
  const utm = source?.utm || {};
  const parts: string[] = [];
  if (utm.source) parts.push(`src:${utm.source}`);
  if (utm.medium) parts.push(`med:${utm.medium}`);
  if (utm.campaign) parts.push(`cmp:${utm.campaign}`);
  const label = parts.length ? parts.join(" · ") : (source?.ref ? `ref:${source.ref}` : "direct");
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{label}</span>;
}
function CellMuted({ children }: { children: React.ReactNode }) { return <div className="text-sm text-neutral-600">{children}</div>; }
function Title({ children }: { children: React.ReactNode }) { return <div className="font-medium">{children}</div>; }

export default function LeadsClient({ initial }: { initial: LeadRow[] }) {
  const [leads, setLeads] = useState<LeadRow[]>(initial || []);

  async function fetchLeads() {
    try {
      const url = `/api/leads/list?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        headers: { "Cache-Control": "no-store" },
        next: { revalidate: 0 },
      });
      const json = await res.json();
      if (json?.ok && Array.isArray(json.leads)) {
        const head = (xs: LeadRow[]) => (xs[0]?.id || "") + "|" + (xs[0]?.created_at || "");
        if (head(json.leads) !== head(leads)) setLeads(json.leads);
      }
    } catch {}
  }

  // 30s poll (fallback)
  useEffect(() => {
    fetchLeads();
    const iv = setInterval(fetchLeads, 30_000);
    return () => clearInterval(iv);
  }, []);

  // SSE primary channel (instant updates)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/leads/stream"); // same-origin, cookies included
      es.addEventListener("leads.updated", () => fetchLeads());
      // optional: on hello, we could reconcile, but not required
      es.onerror = () => {
        // if SSE fails, we rely on the 30s poll
        es?.close();
      };
    } catch {
      // ignore; fallback polling already running
    }
    return () => { es?.close(); };
  }, []);

  const count = leads.length;
  const newestTs = leads[0]?.created_at ? new Date(leads[0].created_at).toLocaleString() : "—";

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="text-sm text-neutral-500">Newest first • showing {count} • latest {newestTs}</div>
      </div>

      {count === 0 ? (
        <div className="rounded-xl border p-8 text-center">
          <div className="text-lg font-medium">No leads yet</div>
          <div className="mt-1 text-sm text-neutral-600">Auto‑refresh is on (SSE + 30s fallback).</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full table-fixed">
            <thead className="bg-neutral-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-neutral-600">
                <th className="p-3 w-[22%]">Person</th>
                <th className="p-3 w-[24%]">Contact</th>
                <th className="p-3">Note</th>
                <th className="p-3 w-[20%]">Source</th>
                <th className="p-3 w-[16%]">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((l) => {
                const created = new Date(l.created_at);
                return (
                  <tr key={l.id} className="align-top hover:bg-neutral-50">
                    <td className="p-3"><Title>{l.patient_name || "—"}</Title><CellMuted>ID: {l.id.slice(0, 8)}…</CellMuted></td>
                    <td className="p-3"><div className="text-sm">{l.phone || "—"}</div></td>
                    <td className="p-3"><div className="text-sm whitespace-pre-wrap break-words">{l.note || "—"}</div></td>
                    <td className="p-3"><UtmChip source={l.source} /></td>
                    <td className="p-3"><CellMuted>{created.toLocaleString()}</CellMuted></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-neutral-500">SSE realtime + 30s fallback • Node runtime • No schema changes</div>
    </>
  );
}
