// app/dashboard/leads/page.tsx
// @ts-nocheck
import { createClient } from "@/utils/supabase/server";

export default async function LeadsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in to see your leads.</div>;
  }

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id, slug")
    .eq("owner_id", user.id)
    .single();

  if (providerError) {
    return <div>Error fetching provider: {providerError.message}</div>;
  }

  if (!provider) {
    return <div>No provider profile found.</div>;
  }

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("id, patient_name, phone, status, source, created_at, note")
    .eq("dentist_id", provider.id)
    .order("created_at", { ascending: false });

  if (leadsError) {
    return <div>Error loading leads: {leadsError.message}</div>;
  }

  if (!leads || leads.length === 0) {
    return <div>No leads found.</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Lead Inbox</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Phone</th>
            <th className="border px-2 py-1">Status</th>
            <th className="border px-2 py-1">Source</th>
            <th className="border px-2 py-1">Created</th>
            <th className="border px-2 py-1">Note</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td className="border px-2 py-1">{lead.patient_name}</td>
              <td className="border px-2 py-1">{lead.phone}</td>
              <td className="border px-2 py-1">{lead.status}</td>
              <td className="border px-2 py-1">{lead.source}</td>
              <td className="border px-2 py-1">
                {new Date(lead.created_at).toLocaleString()}
              </td>
              <td className="border px-2 py-1">{lead.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
