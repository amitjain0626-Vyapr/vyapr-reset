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
  const parts = [];
  if (utm.source) parts.push(`src:${utm.source}`);
  if (utm.medium) parts.push(`med:${utm.medium}`);
  if (utm.campaign) parts.push(`cmp:${utm.campaign}`);
  const label = parts.length ? parts.join(" · ") : (source?.ref ? `ref:${source.ref}` : "direct");
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{label}</span>;
}

function CellMuted({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-neutral-600">{children}</div>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <div className="font-medium">{children}</div>;
}

export default function LeadsClient({ initial }: { initial: LeadRow[] }) {
  const [leads, setLeads] = useState<LeadRow[]>(initial || []);

  useEffect(() => {
    let mounted = true;

    async function fetchLeads() {
      try {
        const url = `/api/leads/list?t=${Date.now()}`; // bust every call
        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
          headers: { "Cache-Control": "no-store" },
          next: { revalidate: 0 },
        });
        const json = await res.json();
        if (mounted && json?.ok && Array.isArray(json.leads)) {
          // update only if head changes
          const head = (xs: LeadRow[]) => (xs[0]?.id || "") + "|" + (xs[0]?.created_at || "");
          if (head(json.leads) !== head(leads)) setLeads(json.leads);
        }
      } catch {}
    }

    fetchLeads();                        // immediate
    const iv = setInterval(fetchLeads, 30_000); // 30s
    return () => { mounted = false; clearInterval(iv); };
  }, [/* none */]);

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
          <div className="mt-1 text-sm text-neutral-600">This view auto‑refreshes every 30s.</div>
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

      <div className="text-xs text-neutral-500">Auto‑refresh: 30s • No schema changes • Node runtime preserved</div>
    </>
  );
}
