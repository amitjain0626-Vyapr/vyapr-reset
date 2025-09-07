// app/api/providers/meta/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Read-only provider meta for TG-aware templates.
 * Returns:
 * {
 *   ok: true,
 *   provider: { id, slug, display_name, category, location },
 *   services: [{ name }... ]  // optional, up to 10
 * }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

  const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

  let provider = null;
  try {
    const { data, error } = await supabase
      .from("Providers")
      .select("id, slug, display_name, category, location")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    provider = data || null;
  } catch {
    // keep provider = null (safe)
  }

  let services: Array<{ name: string }> = [];
  try {
    const { data, error } = await supabase
      .from("Services")
      .select("name, provider_slug")
      .eq("provider_slug", slug)
      .order("name", { ascending: true })
      .limit(10);
    if (!error && Array.isArray(data)) {
      services = data.filter(x => x?.name).map(x => ({ name: x.name }));
    }
  } catch {
    // optional
  }

  return NextResponse.json({ ok: true, provider, services }, { headers: { "Cache-Control": "no-store" } });
}
