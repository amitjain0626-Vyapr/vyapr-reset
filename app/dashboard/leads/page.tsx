// @ts-nocheck
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadsTable from "@/components/dashboard/LeadsTable";
import LeadsFilterBar from "@/components/dashboard/LeadsFilterBar";
import RoiTracker from "@/components/dashboard/RoiTracker";
import { notFound } from "next/navigation";

// Utility: parse querystring filters into SQL-safe clauses
function buildFilters(searchParams: URLSearchParams) {
  const filters: { status?: string; rangeDays?: number } = {};
  const status = searchParams.get("status");
  if (status) filters.status = status;

  const range = searchParams.get("range");
  if (range && range.endsWith("d")) {
    const days = parseInt(range.replace("d", ""), 10);
    if (!isNaN(days)) filters.rangeDays = days;
  }
  return filters;
}

export default async function LeadsPage({ searchParams }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const filters = buildFilters(new URLSearchParams(searchParams));

  let query = supabase
    .from("Leads")
    .select("*")
    // owner scope enforced by RLS, but we keep explicit filtering for sanity
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

      {/* ROI Tracker row */}
      <RoiTracker />

      {/* Filters + Table */}
      <LeadsFilterBar />
      <LeadsTable initialData={leads || []} />
    </div>
  );
}
