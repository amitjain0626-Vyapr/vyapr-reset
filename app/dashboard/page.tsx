// @ts-nocheck
import { createSupabaseServerClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from('Leads')
    .select('*')
    .eq('created_by', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Leads</h1>

      {!leads?.length && <p className="text-gray-500">No leads yet.</p>}

      {leads?.map((lead: any) => (
        <div key={lead.id} className="border p-3 rounded mb-2 bg-gray-50">
          <p className="text-sm">Source: {lead.source}</p>
          <p className="text-xs text-gray-500">Slug: {lead.slug}</p>
        </div>
      ))}
    </div>
  );
}
