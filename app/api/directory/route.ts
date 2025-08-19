// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || 1);
  const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
  const category = (searchParams.get("category") || "").trim();
  const city = (searchParams.get("city") || "").trim();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from("Providers")
    .select(
      "id, display_name, slug, category, location, bio, phone, whatsapp, published",
      { count: "exact" }
    )
    .eq("published", true);

  if (category) q = q.ilike("category", `%${category}%`);
  if (city) q = q.ilike("location", `%${city}%`);

  const { data, error, count } = await q.range(from, to).order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Query failed", details: error.message },
      { status: 500 }
    );
  }

  // No legacy "name" or "url" fields; keep schema clean
  return NextResponse.json({
    ok: true,
    page,
    limit,
    total: count || 0,
    providers: data || [],
  });
}
