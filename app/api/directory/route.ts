// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/site";

export async function GET(req) {
  const supabase = await createSupabaseServerClient();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "20")));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("Providers")
    .select("id, display_name, slug, category, bio, phone, whatsapp, created_at", { count: "exact" })
    .eq("published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const base = getBaseUrl();
  const providers = (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    slug: p.slug,
    category: p.category,
    url: `${base}/book/${encodeURIComponent(p.slug)}`,
    bio: p.bio,
    phone: p.phone,
    whatsapp: p.whatsapp,
    created_at: p.created_at,
  }));

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total: count ?? providers.length,
    providers,
  });
}
