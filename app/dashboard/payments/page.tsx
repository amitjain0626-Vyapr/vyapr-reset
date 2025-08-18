// app/dashboard/payments/page.tsx
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import PaymentsTable from "../../../components/payments/PaymentsTable";
import { redirect } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";

type PaymentRow = {
  id: string;
  patient: string | null;
  amount: number | null;
  status: string | null;
  method: string | null;
  created_at: string | null;
  notes: string | null;
  deleted_at: string | null;
};

async function loadPayments() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data, error } = await supabase
      .from("Payments")
      .select("id,patient,amount,status,method,created_at,notes,deleted_at")
      .is("deleted_at", null)               // ← filter out soft-deleted rows
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as PaymentRow[]).map((r) => ({
      id: r.id,
      patient: r.patient ?? "—",
      amount: typeof r.amount === "number" ? r.amount : 0,
      status: r.status ?? "pending",
      method: r.method ?? undefined,
      createdAt: r.created_at ?? undefined,
      notes: r.notes ?? undefined,
    }));
  } catch {
    return [];
  }
}

export default async function PaymentsPage() {
  const rows = await loadPayments();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-gray-600">Recent transactions and settlement status.</p>
      </div>

      {/* Inline Create Payment form (server action wired in actions.ts) */}
      {/* If you've already added actions.ts (Step 30.6), this form exists there; keep whichever version you prefer. */}
      {/* <form action={createPayment} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 border rounded-xl"> ... </form> */}

      <PaymentsTable data={rows} />
    </div>
  );
}
