// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  const status = (searchParams.get("status") || "all").trim(); // optional
  const q = (searchParams.get("q") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  // Resolve provider_id via providers.slug OR microsites.slug
  let providerId: string | null = null;
  const { data: p1 } = await supabase.from("providers").select("id").eq("slug", slug).maybeSingle();
  if (p1?.id) providerId = p1.id;
  if (!providerId) {
    const { data: p2 } = await supabase.from("microsites").select("provider_id").eq("slug", slug).maybeSingle();
    if (p2?.provider_id) providerId = p2.provider_id;
  }
  if (!providerId) return NextResponse.json({ ok: false, error: "provider not found" }, { status: 404 });

  // Only select safe columns that exist in all envs. Anything else comes from meta JSON if present.
  let query = supabase
    .from("leads")
    .select("id, patient_name, phone, note, created_at, meta", { count: "exact" })
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  // Search (name/phone) — safe
  if (q) query = query.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%`);
  // Date range — safe
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // Map UI fields from columns or meta
  const rows = (data || []).map((r: any) => {
    const m = r.meta || {};
    return {
      id: r.id,
      patient_name: r.patient_name ?? m.name ?? null,
      phone: r.phone ?? m.phone ?? null,
      note: r.note ?? m.note ?? null,
      // UI-only, tolerate absence; prefer column if exists else meta
      status: m.status ?? null,
      when: m.when ?? null,
      source: m.source ?? null,
      created_at: r.created_at,
    };
  });

  // Optional status filter (applied after mapping if status is meta-driven)
  const filtered = status === "all" ? rows : rows.filter((r: any) => (r.status || "new") === status);

  return NextResponse.json({
    ok: true,
    rows: filtered,
    page,
    limit,
    total: count || filtered.length || 0,
  });
}
