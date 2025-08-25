// @ts-nocheck
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import LeadTable from "../../../components/dashboard/LeadTable";
import LeadsFilterBar from "../../../components/dashboard/LeadsFilterBar";
import RoiTracker from "../../../components/dashboard/RoiTracker";
import { notFound } from "next/navigation";

// In Next.js 15, searchParams is a Promise; await it before use.
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
  if (!user) return notFound();

  // ✅ Await searchParams (Next 15)
  const sp = (await searchParams) || {};
  const filters = buildFilters(sp);

  let query = supabase
    .from("Leads")
    .select("*")
    // RLS scopes rows to the signed-in owner
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

      {/* ROI tracker row */}
      <RoiTracker />

      {/* Filters + Table */}
      <LeadsFilterBar />
      <LeadTable initialData={leads || []} />
    </div>
  );
}
