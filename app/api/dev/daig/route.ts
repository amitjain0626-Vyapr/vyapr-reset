// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/app/utils/supabase/server";

const REQUIRED = {
  Dentists: [
    "id","user_id","name","email","phone","slug","is_published","about",
    "address_line1","address_line2","city","state","pincode","country",
    "profile_image_url","clinic_image_url","hours","services","created_at","updated_at",
  ],
  Leads: [
    "id","dentist_id","name","email","phone","message","source","status","created_at","updated_at",
  ],
  Payments: [
    "id","dentist_id","user_id","amount","currency","provider","provider_order_id",
    "receipt","status","notes","created_at","updated_at",
  ],
};

async function checkTable(supabase: any, table: string, expectedCols: string[]) {
  // columns
  const { data: cols, error: colsErr } = await supabase
    .from("information_schema.columns" as any)
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table.replace(/"/g, ""))
    .order("column_name");

  // rls enabled?
  const { data: rlsData } = await supabase
    .from("pg_catalog.pg_class" as any)
    .select("relname, relrowsecurity:relrowsecurity")
    .eq("relname", table.replace(/"/g, ""))
    .maybeSingle();

  // simple count
  const { count, error: cntErr } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  const existingCols = (cols || []).map((c: any) => c.column_name);
  const missing = expectedCols.filter((c) => !existingCols.includes(c));
  return {
    table,
    hasTable: !colsErr && existingCols.length > 0,
    missingColumns: missing,
    rlsEnabled: !!rlsData?.relrowsecurity,
    count: typeof count === "number" ? count : null,
    errors: {
      columns: colsErr?.message || null,
      count: cntErr?.message || null,
    },
  };
}

async function checkBucket(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("storage.buckets" as any)
    .select("id, public")
    .eq("id", id)
    .maybeSingle();
  return {
    bucket: id,
    exists: !!data,
    public: !!data?.public,
    error: error?.message || null,
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const env = {
      NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE, // ok if false in prod
      NODE_ENV: process.env.NODE_ENV || "unknown",
    };

    const tables = await Promise.all([
      checkTable(supabase, "Dentists", REQUIRED.Dentists),
      checkTable(supabase, "Leads", REQUIRED.Leads),
      checkTable(supabase, "Payments", REQUIRED.Payments),
    ]);

    const buckets = await Promise.all([
      checkBucket(supabase, "profiles"),
      checkBucket(supabase, "clinics"),
    ]);

    // quick policy smoke (at least one policy exists per table)
    const { data: policiesDentists } = await supabase
      .from("pg_policies" as any)
      .select("polname")
      .eq("schemaname", "public")
      .eq("tablename", "Dentists");
    const { data: policiesLeads } = await supabase
      .from("pg_policies" as any)
      .select("polname")
      .eq("schemaname", "public")
      .eq("tablename", "Leads");
    const { data: policiesPayments } = await supabase
      .from("pg_policies" as any)
      .select("polname")
      .eq("schemaname", "public")
      .eq("tablename", "Payments");

    const summary = {
      ok:
        env.NEXT_PUBLIC_SUPABASE_URL &&
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        tables.every((t) => t.hasTable && t.missingColumns.length === 0 && t.rlsEnabled) &&
        buckets.every((b) => b.exists && b.public) &&
        (policiesDentists?.length || 0) > 0 &&
        (policiesLeads?.length || 0) > 0 &&
        (policiesPayments?.length || 0) > 0,
      env,
      tables,
      policies: {
        Dentists: (policiesDentists || []).map((p: any) => p.polname),
        Leads: (policiesLeads || []).map((p: any) => p.polname),
        Payments: (policiesPayments || []).map((p: any) => p.polname),
      },
      buckets,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "diag failed" }, { status: 500 });
  }
}
