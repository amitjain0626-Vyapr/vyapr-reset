// @ts-nocheck
import { createSupabaseServerClient } from '@/lib/supabase/server';
import PaymentsTable from '@/components/payments/PaymentsTable';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const supabase = await createSupabaseServerClient();

  // Render defensively: we don't force specific columns
  const { data, error } = await supabase
    .from('Payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-2 text-red-600">Failed to load payments: {error.message}</p>
      </div>
    );
  }

  const payments = data ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-gray-500">{payments.length} total</p>
      </div>
      <PaymentsTable payments={payments} />
    </div>
  );
}
