// app/dashboard/leads/page.tsx
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsTable from "../../../components/leads/LeadsTable";
import { redirect } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";
import { createLead } from "./actions";

type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  note: string | null;
  source: string | null;
  created_at: string | null;
};

async function loadLeads() {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data, error } = await supabase
      .from("Leads")
      .select("id,name,phone,note,source,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as LeadRow[]).map((r) => ({
      id: r.id,
      name: r.name ?? "—",
      phone: r.phone ?? undefined,
      note: r.note ?? undefined,
      source: r.source ?? undefined,
      createdAt: r.created_at ?? undefined,
    }));
  } catch {
    return [];
  }
}

export default async function LeadsPage() {
  const rows = await loadLeads();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-gray-600">Latest leads from your microsite, WhatsApp, and other sources.</p>
      </div>

      {/* Inline Create Lead form (server action) */}
      <form action={createLead} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-xl">
        <input name="name" required placeholder="Name *" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input name="phone" placeholder="Phone" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input name="source" placeholder="Source (e.g., Microsite)" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input name="note" placeholder="Note" className="border rounded-lg px-3 py-2 md:col-span-1" />
        <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 md:col-span-1">Add Lead</button>
      </form>

      <LeadsTable data={rows} />
    </div>
  );
}
