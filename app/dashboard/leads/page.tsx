// app/dashboard/leads/page.tsx
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import LeadsClientTable from '@/components/leads/LeadsClientTable';
import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---- IST helpers ----
function istNow() {
  return new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(new Date()));
}
function istStartOfDay(d = new Date()) {
  const x = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(d));
  x.setHours(0, 0, 0, 0);
  return x;
}
function istEndOfDay(d = new Date()) {
  const x = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(d));
  x.setHours(23, 59, 59, 999);
  return x;
}
function istStartOfMonth(d = new Date()) {
  const x = istStartOfDay(d);
  x.setDate(1);
  return x;
}
function istStartOfLastMonth() {
  const n = istNow();
  const x = new Date(n);
  x.setMonth(x.getMonth() - 1);
  return istStartOfMonth(x);
}
function istEndOfLastMonth() {
  const x = istStartOfMonth(istNow());
  x.setMilliseconds(-1);
  return x;
}

type Provider = { id: string; slug: string; display_name?: string | null };
type Lead = { id: string; patient_name?: string | null; phone?: string | null; status?: string | null; created_at?: string | null };

async function fetchProvider(slug: string): Promise<Provider> {
  const sb = admin();
  const { data, error } = await sb.from('Providers').select('id, slug, display_name').eq('slug', slug).single();
  if (error || !data?.id) throw new Error('provider_not_found');
  return { id: data.id, slug: data.slug, display_name: data.display_name };
}

async function fetchLeads(providerId: string): Promise<Lead[]> {
  const sb = admin();
  const { data = [] } = await sb
    .from('Leads')
    .select('id, patient_name, phone, status, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(200);
  return data;
}

// Sum payments in JS (defensive to unknown schema: supports ts or created_at)
async function sumPayments(providerId: string, start: Date, end: Date): Promise<number> {
  try {
    const sb = admin();
    const { data = [] } = await sb
      .from('Payments')
      .select('amount, ts, created_at')
      .eq('provider_id', providerId)
      .gte('ts', start.getTime())
      .lte('ts', end.getTime());

    // If ts filter returned empty due to missing ts column, refetch using created_at
    const rows = Array.isArray(data) && data.length > 0 ? data : (
      await sb
        .from('Payments')
        .select('amount, ts, created_at')
        .eq('provider_id', providerId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
    ).data ?? [];

    let total = 0;
    for (const r of rows as any[]) {
      const amt = Number(r?.amount ?? 0);
      if (!isNaN(amt)) total += amt;
    }
    return total;
  } catch {
    return 0;
  }
}

async function fetchRoi(providerId: string) {
  const today0 = istStartOfDay();
  const today1 = istEndOfDay();
  const d7Start = new Date(today0); d7Start.setDate(d7Start.getDate() - 6); // include today → 7 days rolling
  const d30Start = new Date(today0); d30Start.setDate(d30Start.getDate() - 29); // 30 days rolling
  const mtdStart = istStartOfMonth();
  const lmStart = istStartOfLastMonth();
  const lmEnd = istEndOfLastMonth();

  const [today, d7, d30, mtd, lmtd] = await Promise.all([
    sumPayments(providerId, today0, today1),
    sumPayments(providerId, d7Start, today1),
    sumPayments(providerId, d30Start, today1),
    sumPayments(providerId, mtdStart, today1),
    sumPayments(providerId, lmStart, lmEnd),
  ]);

  return { today, d7, d30, mtd, lmtd };
}

export default async function Page(props: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await props.searchParams;
  const _slug = (slug || '').trim();
  if (!_slug) {
    return (
      <main className=" p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-red-600 mt-2">Missing ?slug= in URL.</p>
      </main>
    );
  }

  let provider: Provider, rows: Lead[], roi: { today: number; d7: number; d30: number; mtd: number; lmtd: number };
  try {
    provider = await fetchProvider(_slug);
    [rows, roi] = await Promise.all([fetchLeads(provider.id), fetchRoi(provider.id)]);
  } catch {
    return (
      <main className=" p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-red-600 mt-2">Provider not found for slug “{_slug}”.</p>
      </main>
    );
  }

  const fmtINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const delta = roi.lmtd > 0 ? Math.round(((roi.mtd - roi.lmtd) / roi.lmtd) * 100) : 0;
  const deltaText = `${delta >= 0 ? '+' : ''}${delta}%`;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Leads</h1>
      <div className="text-sm text-gray-600">Provider: <span className="font-mono">{provider.slug}</span></div>

      {/* ROI cards (restored) */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">TODAY</div>
          <div className="text-2xl font-bold">{fmtINR(roi.today)}</div>
          <div className="text-xs text-gray-400">Since midnight IST</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">7D</div>
          <div className="text-2xl font-bold">{fmtINR(roi.d7)}</div>
          <div className="text-xs text-gray-400">Last 7 days (rolling)</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">30D</div>
          <div className="text-2xl font-bold">{fmtINR(roi.d30)}</div>
          <div className="text-xs text-gray-400">Last 30 days (rolling)</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">MTD</div>
          <div className="text-2xl font-bold">{fmtINR(roi.mtd)}</div>
          <div className="text-xs text-gray-400">Month-to-date (IST)</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">LMTD</div>
          <div className="text-2xl font-bold">{fmtINR(roi.lmtd)}</div>
          <div className="text-xs text-gray-400">Last month to date</div>
        </div>
      </div>

      {/* Actions bar (kept minimal) */}
      <div className="flex items-center gap-2">
        <a
          href={`/dashboard/nudges?slug=${provider.slug}`}
          className="px-3 py-2 rounded border hover:bg-gray-50"
        >
          Nudge Center
        </a>
        <a
          href={`/dashboard/leads/quick?slug=${provider.slug}`}
          className="px-3 py-2 rounded border hover:bg-gray-50"
        >
          + Quick Add
        </a>
      </div>

      {/* Leads Table */}
      <LeadsClientTable rows={rows} provider={provider} />
    </main>
  );
}
