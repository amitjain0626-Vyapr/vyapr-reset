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

async function fetchProviderAndLeads(slug: string) {
  const sb = admin();

  // 1) provider
  const { data: prov, error: pErr } = await sb
    .from('Providers')
    .select('id, slug, display_name')
    .eq('slug', slug)
    .single();
  if (pErr || !prov?.id) throw new Error('provider_not_found');

  // 2) leads (latest first)
  const { data: rows = [] } = await sb
    .from('Leads')
    .select('id, patient_name, phone, status, created_at')
    .eq('provider_id', prov.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return { provider: { id: prov.id, slug: prov.slug, display_name: prov.display_name }, rows };
}

export default async function Page(props: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await props.searchParams;
  const _slug = (slug || '').trim();
  if (!_slug) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-red-600 mt-2">Missing ?slug= in URL.</p>
      </main>
    );
  }

  let provider, rows;
  try {
    const data = await fetchProviderAndLeads(_slug);
    provider = data.provider;
    rows = data.rows;
  } catch {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-red-600 mt-2">Provider not found for slug “{_slug}”.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Leads</h1>
      <div className="text-sm text-gray-600">
        Provider: <span className="font-mono">{provider.slug}</span>
      </div>

      {/* Table (now actually receives rows) */}
      <LeadsClientTable rows={rows} provider={provider} />
    </main>
  );
}
