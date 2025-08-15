// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/leads/list?slug=<provider-or-microsite-slug>&status=<all|new|...>&q=<text>&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
 * - Resolves provider by providers.slug OR microsites.slug
 * - Filters leads by dentist_id
 * - Selects schema-accurate fields only (no meta/when/source)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  const status = (searchParams.get("status") || "all").trim();
  const q = (searchParams.get("q") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });

  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookies().get(n)?.value } }
  );

  // Resolve provider id via providers.slug OR microsites.slug → provider_id
  let providerId: string | null = null;

  const { data: p1 } = await supa.from("providers").select("id").eq("slug", slug).maybeSingle();
  if (p1?.id) providerId = p1.id;

  if (!providerId) {
    const { data: m1 } = await supa.from("microsites").select("provider_id").eq("slug", slug).maybeSingle();
    if (m1?.provider_id) providerId = m1.provider_id;
  }

  if (!providerId) {
    return NextResponse.json({ ok: false, error: "provider not found" }, { status: 404 });
  }

  // leads.dentist_id FK -> providers.id
  let query = supa
    .from("leads")
    .select("id, patient_name, phone, note, status, source_slug, created_at", { count: "exact" })
    .eq("dentist_id", providerId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%`);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59Z`);

  const { data: rows, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    rows: rows || [],
    page,
    limit,
    total: count || 0,
  });
}
