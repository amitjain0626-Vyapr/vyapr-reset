// app/api/internal/sitemap/providers/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ensure Node runtime

export async function GET(req: Request) {
  const token = req.headers.get("x-sitemap-token");
  const secret = process.env.SITEMAP_INTERNAL_TOKEN || "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // fallback (won't bypass RLS)

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });

  // Only select safe columns; filter to published=true even with service role
  const { data, error } = await supabase
    .from("Providers")
    .select("slug, category, location, created_at, updated_at")
    .eq("published", true);

  if (error || !Array.isArray(data)) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
