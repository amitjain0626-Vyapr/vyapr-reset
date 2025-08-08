// @ts-nocheck
import { createSupabaseServerClient } from "@/app/utils/supabase/server";
import MockOrderButton from "@/components/payments/MockOrderButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "unknown";

  // Resolve dentist for current user (optional render info)
  const { data: dentist } = await supabase
    .from("Dentists")
    .select("id, name, slug, is_published")
    .eq("user_id", user?.id || "")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Vyapr • Dashboard</h1>
      <p className="text-sm mb-6">Signed in as <b>{email}</b></p>

      <section className="border rounded-2xl p-4 mb-6">
        <h2 className="text-lg font-medium mb-2">Your Microsite</h2>
        {dentist ? (
          <div className="text-sm">
            <div className="mb-1">Name: <b>{dentist.name || "—"}</b></div>
            <div className="mb-1">Slug: <b>{dentist.slug || "—"}</b></div>
            <div className="mb-1">Published: <b>{dentist.is_published ? "Yes" : "No"}</b></div>
            {dentist.slug ? (
              <a
                className="inline-block mt-3 underline"
                href={`/d/${dentist.slug}`}
