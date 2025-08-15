// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/leads/list?slug=<slug>&q=<str>&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
 * - Resolves provider by providers.slug OR microsites.slug
 * - Tries filtering by owner_id, then falls back to provider_id
 * - Selects "*" and safely maps only present fields
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

  if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });

  const supaSSR = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookies().get(n)?.value } }
  );

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

  // Helper to run query with a candidate FK column
  async function fetchWithFk(fkCol: "owner_id" | "provider_id") {
    let q1 = supaSSR
      .from("leads")
      .select("*", { count: "exact" })
      .eq(fkCol, providerId)
      .order("created_at", { ascending: false });

    if (q) q1 = q1.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%`);
    if (from) q1 = q1.gte("created_at", `${from}T00:00:00Z`);
    if (to) q1 = q1.lte("created_at", `${to}T23:59:59Z`);

    const { data, error, count } = await q1.range(offset, offset + limit - 1);
    return { data, error, count, fk: fkCol };
  }

  // 2) Try owner_id, then provider_id
  let out = await fetchWithFk("owner_id");
  if (out.error && /column.*owner_id.*does not exist/i.test(out.error.message || "")) {
    out = await fetchWithFk("provider_id");
  }

  if (out.error) {
    return NextResponse.json({ ok: false, error: out.error.message }, { status: 400 });
  }

  const rows = (out.data || []).map((r: any) => {
    // Map only fields that exist on the row
    return {
      id: r.id,
      patient_name: r.patient_name ?? r.name ?? null,
      phone: r.phone ?? null,
      note: r.note ?? null,
      created_at: r.created_at ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    rows,
    page,
    limit,
    total: out.count || 0,
    fk: out.fk, // for diagnosis; safe to keep
  });
}
