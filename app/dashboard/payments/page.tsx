// @ts-nocheck
import { createSupabaseServerClient } from "@/app/utils/supabase/server";
import PaymentsTable from "@/components/payments/PaymentsTable";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // resolve dentist owned by user
  const { data: dentist } = await supabase
    .from("Dentists")
    .select("id, name, slug")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!dentist) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-2">Payments</h1>
        <p className="text-sm">No dentist profile found. Complete onboarding first.</p>
      </main>
    );
  }

  const { data: payments } = await supabase
    .from("Payments")
    .select(
      "id, amount, currency, provider, provider_order_id, receipt, status, created_at"
    )
    .eq("dentist_id", dentist.id)
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <a className="text-sm underline" href="/dashboard">← Back to dashboard</a>
      </div>
      <PaymentsTable initialRows={payments || []} />
    </main>
  );
}
