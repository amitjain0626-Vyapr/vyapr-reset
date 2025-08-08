// @ts-nocheck
import { createSupabaseServerClient } from '../lib/supabase/server-helpers';
import MockOrderButton from "@/components/payments/MockOrderButton";
import SignOutButton from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "unknown";

  const { data: dentist } = await supabase
    .from("Dentists")
    .select("id, name, slug, is_published")
    .eq("user_id", user?.id || "")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Vyapr • Dashboard</h1>
        <SignOutButton />
      </div>
      <p className="text-sm mb-6">Signed in as <b>{email}</b></p>

      <section className="border rounded-2xl p-4 mb-6">
        <h2 className="text-lg font-medium mb-2">Your Microsite</h2>
        {dentist ? (
          <div className="text-sm">
            <div className="mb-1">Name: <b>{dentist.name || "—"}</b></div>
            <div className="mb-1">Slug: <b>{dentist.slug || "—"}</b></div>
            <div className="mb-1">Published: <b>{dentist.is_published ? "Yes" : "No"}</b></div>
            <div className="flex items-center gap-4 mt-3">
              {dentist.slug && (
                <a className="underline" href={`/d/${dentist.slug}`} target="_blank" rel="noreferrer">
                  View microsite
                </a>
              )}
              <a className="underline" href="/dashboard/leads">View leads</a>
              <a className="underline" href="/dashboard/payments">View payments</a>
            </div>
          </div>
        ) : (
          <div className="text-sm">No dentist profile found. Complete onboarding.</div>
        )}
      </section>

      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-medium mb-3">Payments (Mock)</h2>
        <p className="text-sm mb-4">Create a mock Razorpay order for ₹499 to test DB + API.</p>
        <MockOrderButton amountPaise={49900} />
      </section>
    </main>
  );
}
