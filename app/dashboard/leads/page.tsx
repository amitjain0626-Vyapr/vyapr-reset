// @ts-nocheck
import dynamic from 'next/dynamic';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import LeadsTable from '@/components/leads/LeadsTable';

// Force Node runtime; avoid Edge quirks
export const runtime = 'nodejs';
// Always render fresh (dashboard data)
export const dynamic = 'force-dynamic';

// Load the realtime subscriber only on the client
const EventsSubscriber = dynamic(() => import('@/components/EventsSubscriber'), {
  ssr: false,
});

export default async function LeadsPage() {
  const supabase = await createSupabaseServerClient(cookies());

  const { data: leads, error } = await supabase
    .from('Leads')
    .select('id, patient_name, phone, note, status, source, created_at')
    .order('created_at', { ascending: false });

  return (
    <>
      <EventsSubscriber />
      <div className="p-6 space-y-4">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-gray-500">{(leads?.length ?? 0)} total</p>
        </div>
        {error ? (
          <p className="text-red-600">Failed to load leads: {error.message}</p>
        ) : (
          <LeadsTable leads={leads ?? []} />
        )}
      </div>
    </>
  );
}
