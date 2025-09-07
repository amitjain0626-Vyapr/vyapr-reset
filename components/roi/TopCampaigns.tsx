// @ts-nocheck
import { headers } from "next/headers";

type Row = { label: string; leads?: number; reminders?: number; rebooks?: number };

async function fetchCampaigns(slug: string) {
  try {
    const h = headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const origin = `${proto}://${host}`;
    const url = `${origin}/api/roi/top-campaigns?slug=${encodeURIComponent(slug)}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, rows: [], error: `HTTP ${res.status}` };
    const json = await res.json();
    return json || { ok: false, rows: [] };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || "fetch failed" };
  }
}

export default async function TopCampaigns({ slug }: { slug: string }) {
  const data = await fetchCampaigns(slug);
  const rows: Row[] = Array.isArray(data?.rows) ? data.rows : [];
  const hasData = rows.length > 0;

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">Top campaigns (last 30 days)</h2>
      </div>

      {!hasData ? (
        <div className="text-sm text-gray-500">
          {data?.error ? `No data ( ${data.error} )` : "No campaign activity yet."}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Campaign</th>
              <th className="py-2">Leads</th>
              <th className="py-2">Reminders</th>
              <th className="py-2">Reactivations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">{r.label}</td>
                <td className="py-2">{r.leads ?? 0}</td>
                <td className="py-2">{r.reminders ?? 0}</td>
                <td className="py-2">{r.rebooks ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="text-xs text-gray-500 mt-2">Source: Events.source.utm (no schema change)</div>
    </div>
  );
}
