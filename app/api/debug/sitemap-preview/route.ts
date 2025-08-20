// app/api/debug/sitemap-preview/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function slugify(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Pull all published providers (public read via RLS)
    const { data, error } = await supabase
      .from("Providers")
      .select("id, slug, display_name, published, category, location, updated_at")
      .eq("published", true);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];
    const withCatLoc = rows.filter(r => r.category && r.location);

    // Compute unique combos (category-location)
    const combosSet = new Set<string>();
    for (const r of withCatLoc) {
      const combo = `${slugify(r.category)}-${slugify(r.location)}`;
      combosSet.add(combo);
    }

    return NextResponse.json({
      ok: true,
      count_published: rows.length,
      count_with_category_and_location: withCatLoc.length,
      combos: Array.from(combosSet).sort(),
      sample_published: rows.slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
