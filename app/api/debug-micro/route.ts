// @ts-nocheck
// app/api/debug-micro/route.ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../lib/supabase/server"; // ../../../ is correct from /app/api/*

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "dr-kapoor").trim();

  try {
    const supabase = getServerSupabase();

    // Fetch EXACTLY what the DB returns (avoid column mismatches)
    const { data, error } = await supabase
      .from("Dentists")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      ok: !error,
      slug,
      error: error?.message || null,
      data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, slug, error: String(e), data: null },
      { status: 500 }
    );
  }
}
