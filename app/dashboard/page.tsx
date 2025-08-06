import { createClient } from '@/app/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect('/login');

  const { data: leads } = await supabase
    .from('Leads')
    .select('*')
    .eq('owner_id', user.id)
    .order('timestamp', { ascending: false });

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📈 Your Microsite Clicks</h1>

      {leads?.length === 0 && (
        <p>No clicks tracked yet. Share your microsite to see leads here.</p>
      )}

      {leads?.map((lead) => (
        <div key={lead.id} className="border p-3 rounded mb-2 bg-gray-50">
          <p className="text-sm">Source: {lead.source}</p>
          <p className="text-xs text-gray-500">Slug: {lead.slug}</p>
          <p className="text-xs text-gray-500">Time: {new Date(lead.timestamp).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
