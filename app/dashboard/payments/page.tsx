// @ts-nocheck
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import PaymentsTable from '@/components/payments/PaymentsTable';
import CreateTestPaymentButton from '@/components/payments/CreateTestPaymentButton';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const supabase = await createSupabaseServerClient();

  // Get the user (SSR)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    redirect('/login');
  }

  // Only the current user's payments (RLS will enforce anyway)
  const { data, error } = await supabase
    .from('Payments')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-2 text-red-600">Failed to load payments: {error.message}</p>
      </div>
    );
  }

  const payments = Array.isArray(data) ? data : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{payments.length} total</p>
          <CreateTestPaymentButton />
        </div>
      </div>
      <PaymentsTable payments={payments} />
    </div>
  );
}
