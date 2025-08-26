// app/dashboard/events/page.tsx
// @ts-nocheck
import { cookies } from 'next/headers';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchData(slug?: string | null) {
  const sb = admin();

  // resolve provider_id from slug (optional)
  let providerId: string | null = null;
  if (slug) {
    const { data: prov } = await sb.from('Providers').select('id').eq('slug', slug).single();
    providerId = prov?.id ?? null;
  }

  // today’s counts for wa.* events
  let q = sb
    .from('Events')
    .select('event, ts, lead_id, source')
    .gte('ts', Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime()))
    .lte('ts', Math.floor(new Date(new Date().setHours(23, 59, 59, 999)).getTime()))
    .order('ts', { ascending: false })
    .limit(50);

  if (providerId) q = q.eq('provider_id', providerId);

  const { data: rows = [] } = await q;

  const countReminder = rows.filter(r => r.event === 'wa.reminder.sent').length;
  const countRebook = rows.filter(r => r.event === 'wa.rebook.sent').length;
  const countSuggested = rows.filter(r => r.event === 'nudge.suggested').length;

  return { rows, countReminder, countRebook, countSuggested, providerId };
}

export default async function Page({ searchParams }: { searchParams: { slug?: string } }) {
  const slug = searchParams?.slug ?? null;
  const { rows, countReminder, countRebook, countSuggested } = await fetchData(slug);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Events Inspector {slug ? `— ${slug}` : ''}</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Today · Reminder sent</div>
          <div className="text-3xl font-bold">{countReminder}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Today · Rebooking sent</div>
          <div className="text-3xl font-bold">{countRebook}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">Today · Suggested</div>
          <div className="text-3xl font-bold">{countSuggested}</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Latest events (today)</h2>
        <div className="rounded-lg border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Time (IST)</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Lead</th>
                <th className="text-left px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const d = new Date(r.ts);
                const ist = new Intl.DateTimeFormat('en-IN', {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                  timeZone: 'Asia/Kolkata',
                }).format(d);
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{ist}</td>
                    <td className="px-3 py-2">{r.event}</td>
                    <td className="px-3 py-2">{r.lead_id ?? '-'}</td>
                    <td className="px-3 py-2">
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.source ?? {}, null, 0)}</pre>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-gray-500" colSpan={4}>
                    No events today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
