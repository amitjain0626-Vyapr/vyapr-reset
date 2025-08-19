// app/api/public/providers/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ensure Node runtime for supabase-js
export const revalidate = 0;

export async function GET() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Return empty list but do not 500; sitemap will still include core URLs.
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });

  // Public: only return published providers
  const { data, error } = await supabase
    .from("Providers")
    .select("slug, category, location, created_at, updated_at")
    .eq("published", true);

  if (error || !Array.isArray(data)) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
