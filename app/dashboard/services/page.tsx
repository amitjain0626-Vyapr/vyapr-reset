// @ts-nocheck
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: services } = await supabase
    .from('Services')
    .select('*')
    .eq('created_by', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Your Services</h1>

      {!services?.length && <p className="text-gray-500">No services added yet.</p>}

      <h2 className="text-lg font-semibold mb-2">Existing Services</h2>
      {services?.map((s: any) => (
        <div key={s.id} className="border p-3 rounded mb-2 bg-gray-50">
          <p className="font-bold">{s.title}</p>
          <p className="text-sm">{s.description}</p>
        </div>
      ))}
    </div>
  );
}
