// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("Providers")
    .select("id, slug, published, category, location")
    .eq("published", true);

  if (error) {
    return NextResponse.json({ ok:false, stage:"select", error: error.message }, { status: 500 });
  }

  // only return a small projection
  return NextResponse.json({
    ok: true,
    count: (data || []).length,
    slugs: (data || []).map(r => r.slug),
    sample: (data || []).slice(0, 3),
  });
}
