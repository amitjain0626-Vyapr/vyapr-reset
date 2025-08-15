// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET /api/leads/list?slug=<slug>&q=<str>&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
 * - Resolves provider by providers.slug OR microsites.slug
 * - Introspects public.leads to find the correct FK column: owner_id OR provider_id
 * - Selects only columns that exist (id, patient_name, phone, note, created_at)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  const q = (searchParams.get("q") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
  }

  // SSR client for user-owned reads; Admin client for schema introspection (safe on server)
  const supaSSR = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookies().get(n)?.value } }
  );
  const supaAdmin = createAdminClient();

  // 1) Resolve providerId by providers.slug OR microsites.slug
  let providerId: string | null = null;

  const { data: p1 } = await supaSSR
    .from("providers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (p1?.id) providerId = p1.id;
  if (!providerId) {
    const { data: p2 } = await supaSSR
      .from("microsites")
      .select("provider_id")
      .eq("slug", slug)
      .maybeSingle();
    providerId = p2?.provider_id ?? null;
  }
  if (!providerId) {
    return NextResponse.json({ ok: false, error: "provider not found" }, { status: 404 });
  }

  // 2) Introspect leads table to discover FK and safe columns
  const { data: cols, error: colsErr } = await supaAdmin
    .from("information_schema.columns" as any)
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "leads");

  if (colsErr || !cols) {
    return NextResponse.json({ ok: false, error: "introspection failed" }, { status: 500 });
  }

  const columnNames = new Set((cols as any[]).map((c) => String(c.column_name)));
  const fkCol =
    columnNames.has("owner_id") ? "owner_id" :
    columnNames.has("provider_id") ? "provider_id" :
    null;

  if (!fkCol) {
    return NextResponse.json({ ok: false, error: "no FK column (owner_id/provider_id) in leads" }, { status: 500 });
  }

  const selectable = ["id", "patient_name", "phone", "note", "created_at"].filter((c) =>
    columnNames.has(c)
  );
  const selectStr = selectable.join(", ");
  if (!selectStr) {
    return NextResponse.json({ ok: false, error: "no selectable columns in leads" }, { status: 500 });
  }

  // 3) Build the query against the discovered schema
  let query = supaSSR
    .from("leads")
    .select(selectStr, { count: "exact" })
    .eq(fkCol, providerId)
    .order("created_at", { ascending: false });

  if (q) query = query.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);

  const { data: rows, error, count } = await query.range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    rows: rows || [],
    page,
    limit,
    total: count || 0,
    fk: fkCol,           // debug aid (safe to keep)
    fields: selectable,  // debug aid
  });
}
