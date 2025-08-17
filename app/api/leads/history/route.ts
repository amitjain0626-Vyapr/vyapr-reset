// app/api/leads/history/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";         // ensure Node, not Edge
export const dynamic = "force-dynamic";  // no caching of auth

function isUUIDv4(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!isUUIDv4(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // Must have an authenticated user so RLS can authorize
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS: returns row only if owner_id = auth.uid()
  const { data, error } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, status, source, created_at, note, owner_id")
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Forbidden or query error", details: error.message },
      { status: 403 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead: data[0] }, { status: 200 });
}
