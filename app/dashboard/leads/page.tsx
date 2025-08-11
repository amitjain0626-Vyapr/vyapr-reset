// app/dashboard/leads/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import LeadsTable from "../../../components/leads/LeadsTable";
import { redirect } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";

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

    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Leads</h1>
        <p className="text-sm text-gray-600">
          Latest leads from your microsite, WhatsApp, and other sources.
        </p>
      </div>
      <LeadsTable data={rows} />
    </div>
  );
}
