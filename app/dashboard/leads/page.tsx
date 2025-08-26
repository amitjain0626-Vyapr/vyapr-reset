// app/dashboard/leads/page.tsx
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import LeadsClientTable from '@/components/leads/LeadsClientTable';
import QuickAddLead from '@/components/leads/QuickAddLead';
import { createClient } from '@supabase/supabase-js';

/* ---------- supabase admin ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- IST helpers ---------- */
function istStartOfDay(d = new Date()) {
  const x = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(d));
  x.setHours(0, 0, 0, 0); return x;
}
function istEndOfDay(d = new Date()) {
  const x = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata' }).format(d));
  x.setHours(23, 59, 59, 999); return x;
}
function istStartOfMonth(d = new Date()) {
  const x = istStartOfDay(d); x.setDate(1); return x;
}
function istStartOfLastMonth() {
  const n = new Date(); n.setMonth(n.getMonth() - 1); return istStartOfMonth(n);
}
function istEndOfLastMonth() {
  const x = istStartOfMonth(new Date()); x.setMilliseconds(-1); return x;
}

/* ---------- types ---------- */
type Provider = { id: string; slug: string; display_name?: string | null };
type Lead = { id: string; patient_name?: string | null; phone?: string | null; status?: string | null; created_at?: string | null };

/* ---------- data fetch ---------- */
async function fetchProvider(slug: string): Promise<Provider> {
  const { data, error } = await admin().from('Providers').select('id, slug, display_name').eq('slug', slug).single();
  if (error || !data?.id) throw new Error('provider_not_found');
  return { id: data.id, slug: data.slug, display_name: data.display_name };
}

async function fetchLeads(providerId: string): Promise<Lead[]> {
  const { data = [] } = await admin()
    .from('Leads')
    .select('id, patient_name, phone, status, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(500);
  return data;
}

/* ---------- ROI (Payments) ---------- */
async function sumPayments(providerId: string, start: Date, end: Date): Promise<number> {
  const sb = admin();
  const { data = [] } = await sb
    .from('Payments')
    .select('amount, ts, created_at')
    .eq('provider_id', providerId)
    .gte('ts', start.getTime())
    .lte('ts', end.getTime());
  const rows = (Array.isArray(data) && data.length > 0)
    ? data
    : (await sb
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
}
async function fetchRoi(providerId: string) {
  const today0 = istStartOfDay(); const today1 = istEndOfDay();
  const d7Start = new Date(today0); d7Start.setDate(d7Start.getDate() - 6);
  const d30Start = new Date(today0); d30Start.setDate(d30Start.getDate() - 29);
  const mtdStart = istStartOfMonth();
  const lmStart = istStartOfLastMonth(); const lmEnd = istEndOfLastMonth();
  const [today, d7, d30, mtd, lmtd] = await Promise.all([
    sumPayments(providerId, today0, today1),
    sumPayments(providerId, d7Start, today1),
    sumPayments(providerId, d30Start, today1),
    sumPayments(providerId, mtdStart, today1),
    sumPayments(providerId, lmStart, lmEnd),
  ]);
  return { today, d7, d30, mtd, lmtd };
}

/* ---------- Nudge Center badge ---------- */
async function fetchNudgeCount(providerId: string) {
  const sb = admin();
  const start = istStartOfDay().getTime();
  const end = istEndOfDay().getTime();
  const { count } = await sb
    .from('Events')
    .select('event', { head: true, count: 'exact' })
    .eq('provider_id', providerId)
    .eq('event', 'nudge.suggested')
    .gte('ts', start)
    .lte('ts', end);
  return count ?? 0;
}

/* ---------- helpers ---------- */
function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
}
function applyFilters(rows: Lead[], q?: string, status?: string, sort?: string): Lead[] {
  let out = Array.isArray(rows) ? [...rows] : [];
  const qq = (q || '').trim().toLowerCase();
  if (qq) {
    out = out.filter(r =>
      (r.patient_name || '').toLowerCase().includes(qq) ||
      (r.phone || '').toLowerCase().includes(qq)
    );
  }
  if (status && status !== 'all') {
    out = out.filter(r => (r.status || 'new') === status);
  }
  if (sort === 'oldest') {
    out.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  } else {
    out.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }
  return out;
}

/* ---------- Page ---------- */
export default async function Page(props: { searchParams: Promise<{ slug?: string; q?: string; status?: string; sort?: string }> }) {
  const { slug, q, status, sort } = await props.searchParams;
  const _slug = (slug || '').trim();
  if (!_slug) {
    return <main className="p-6"><h1 className="text-xl font-semibold">Leads</h1><p className="text-sm text-red-600 mt-2">Missing ?slug= in URL.</p></main>;
  }

  let provider: Provider, rows: Lead[], roi: any, nudgeCount = 0;
  try {
    provider = await fetchProvider(_slug);
    [rows, roi, nudgeCount] = await Promise.all([fetchLeads(provider.id), fetchRoi(provider.id), fetchNudgeCount(provider.id)]);
  } catch {
    return <main className="p-6"><h1 className="text-xl font-semibold">Leads</h1><p className="text-sm text-red-600 mt-2">Provider not found for slug “{_slug}”.</p></main>;
  }

  const filtered = applyFilters(rows, q, status, sort);
  const delta = roi.lmtd > 0 ? Math.round(((roi.mtd - roi.lmtd) / roi.lmtd) * 100) : 0;
  const deltaText = `${delta >= 0 ? '+' : ''}${delta}%`;

  return (
    <main className="p-6 space-y-6">
      {/* Header bar: title left, actions right */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <div className="text-sm text-gray-600">
            Provider: <span className="font-mono">{provider.slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* + Quick Add (popover) */}
          <QuickAddLead slug={provider.slug} />

          {/* Nudge Center with badge */}
          <a
            href={`/dashboard/nudges?slug=${provider.slug}`}
            className="px-3 py-2 rounded border hover:bg-gray-50 inline-flex items-center gap-2"
            title="Open Nudge Center"
          >
            Nudge Center
            {nudgeCount > 0 && (
              <span className="text-xs bg-black text-white rounded-full px-2 py-0.5">
                {nudgeCount}
              </span>
            )}
          </a>
        </div>
      </div>

      {/* ROI cards */}
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
          <div className="text-xs text-gray-400">{deltaText} vs LMTD</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">LMTD</div>
          <div className="text-2xl font-bold">{fmtINR(roi.lmtd)}</div>
          <div className="text-xs text-gray-400">Last month to date</div>
        </div>
      </div>

      {/* Filters + Export CSV */}
      <form method="GET" action="/dashboard/leads" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slug" value={provider.slug} />
        <input
          name="q"
          defaultValue={q || ''}
          placeholder="Search name, phone…"
          className="px-3 py-2 rounded border min-w-[260px]"
        />
        <select name="status" defaultValue={status || 'all'} className="px-3 py-2 rounded border">
          <option value="all">All Statuses</option>
          <option value="new">new</option>
          <option value="active">active</option>
          <option value="closed">closed</option>
        </select>
        <select name="sort" defaultValue={sort || 'newest'} className="px-3 py-2 rounded border">
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
        <button type="submit" className="px-3 py-2 rounded border hover:bg-gray-50">Apply</button>

        <a
          className="ml-auto px-3 py-2 rounded border hover:bg-gray-50"
          href={`/api/leads/export?slug=${provider.slug}&q=${encodeURIComponent(q || '')}&status=${encodeURIComponent(
            status || 'all'
          )}&sort=${encodeURIComponent(sort || 'newest')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Export CSV
        </a>
      </form>

      {/* Leads Table */}
      <LeadsClientTable rows={filtered} provider={provider} />
    </main>
  );
}
