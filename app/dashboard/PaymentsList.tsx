// @ts-nocheck
// app/dashboard/PaymentsList.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server-helpers";

type Payment = {
  id: string;
  rp_order_id: string;
  amount_in_paise: number;
  currency: string;
  status: string;
  receipt: string | null;
  created_at: string;
};

export default async function PaymentsList() {
  const supabase = createSupabaseServerClient();

  // Require auth
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) redirect("/login");

  // Fetch last 20 payments for this user (RLS enforced)
  const { data, error } = await supabase
    .from("Payments")
    .select("id, rp_order_id, amount_in_paise, currency, status, receipt, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20) as { data: Payment[] | null; error: any };

  if (error) {
    return (
      <div className="rounded-xl border p-4 text-sm">
        ❌ Couldn’t load payments: {error.message || "Unknown error"}
      </div>
    );
  }

  const payments = data || [];
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm text-gray-600">
        No payments yet. Create a test order above.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Order ID</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">{new Date(p.created_at).toLocaleString()}</td>
              <td className="px-3 py-2 font-mono">{p.rp_order_id}</td>
              <td className="px-3 py-2">₹{(p.amount_in_paise / 100).toFixed(2)} {p.currency}</td>
              <td className="px-3 py-2">{p.status}</td>
              <td className="px-3 py-2">{p.receipt || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
