// app/dashboard/payments/page.tsx
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import PaymentsTable from "../../../components/payments/PaymentsTable";
import { redirect } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";
import { createPayment } from "./actions";

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
    const { data: { user } } = await supabase.auth.getUser();
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
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm text-gray-600">Recent transactions and settlement status.</p>
      </div>

      {/* Inline Create Payment form (server action) */}
      <form action={createPayment} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 border rounded-xl">
        <input name="patient" placeholder="Patient" className="border rounded-lg px-3 py-2 md:col-span-2" />
        <input name="amount" required placeholder="Amount (₹)" inputMode="decimal" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <select name="status" className="border rounded-lg px-3 py-2 md:col-span-1" defaultValue="success">
          <option value="success">success</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
        </select>
        <input name="method" placeholder="Method (UPI/Card)" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input name="notes" placeholder="Notes" className="border rounded-lg px-3 py-2 md:col-span-3" />
        <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 md:col-span-1">Add Payment</button>
      </form>

      <PaymentsTable data={rows} />
    </div>
  );
}
