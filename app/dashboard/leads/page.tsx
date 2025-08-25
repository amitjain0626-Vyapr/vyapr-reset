// @ts-nocheck
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import LeadTable from "../../../components/dashboard/LeadTable";
import LeadsFilterBar from "../../../components/dashboard/LeadsFilterBar";
import RoiTrackerClient from "../../../components/dashboard/RoiTrackerClient"; // <-- use client ROI
import { redirect } from "next/navigation";

// Next 15: searchParams is a Promise
type SP = Record<string, string | string[] | undefined>;

function getParam(sp: SP, key: string): string | null {
  const v = sp?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length) return v[0]!;
  return null;
}

function buildFilters(sp: SP) {
  const filters: { status?: string; rangeDays?: number } = {};
  const status = getParam(sp, "status");
  if (status) filters.status = status;

  const range = getParam(sp, "range");
  if (range && range.endsWith("d")) {
    const days = parseInt(range.slice(0, -1), 10);
    if (!isNaN(days)) filters.rangeDays = days;
  }
  return filters;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (no 404s)
  if (!user) {
    redirect("/login?next=/dashboard/leads");
  }

  const sp = (await searchParams) || {};
  const filters = buildFilters(sp);

  let query = supabase
    .from("Leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.rangeDays) {
    const since = new Date();
    since.setDate(since.getDate() - filters.rangeDays);
    query = query.gte("created_at", since.toISOString());
  }

  const { data: leads, error } = await query;
  if (error) {
    console.error("Error loading leads:", error);
    return <div className="p-4 text-red-500">Failed to load leads</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Leads</h1>

      {/* ROI tracker (client-fetched; won’t crash server) */}
      <RoiTrackerClient />

      {/* Filters + Table */}
      <LeadsFilterBar />
      <LeadTable initialData={leads || []} />
    </div>
  );
}
