// app/dashboard/payments/page.tsx
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
};

async function loadPayments() {
  try {
    const supabase = getServerSupabase();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data, error } = await supabase
      .from("Payments")
      .select("id,patient,amount,status,method,created_at,notes")
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
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-gray-600">
          Recent transactions and settlement status.
        </p>
      </div>
      <PaymentsTable data={rows} />
    </div>
  );
}
