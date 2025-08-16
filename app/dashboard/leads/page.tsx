// app/dashboard/leads/page.tsx
// @ts-nocheck
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createClient();

  // get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // fetch leads where owner_id = current provider id
  // (mapping auth.uid() => provider.id happens in onboarding, so ensure consistent)
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, patient_name, phone, note, status, source, slug, utm"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Leads fetch error", error);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-6">📥 Leads Inbox</h1>
      {!leads || leads.length === 0 ? (
        <p className="text-gray-600">No leads yet.</p>
      ) : (
        <ul className="space-y-4">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="border rounded-lg p-4 shadow-sm bg-white"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">
                  {lead.patient_name || "Unknown"}
                </h2>
                <span className="text-xs text-gray-500">
                  {new Date(lead.created_at).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-sm text-gray-700">
                📞 {lead.phone} <br />
                📝 {lead.note || "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Status: {lead.status} | Source: {lead.source} | Slug:{" "}
                {lead.slug}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
