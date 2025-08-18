// app/api/leads/update-note/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id, note } = await req.json();

  // phase 1: ensure it exists (respects RLS ownership)
  const { data: lead, error: selErr } = await supabase.from("Leads").select("id").eq("id", id).single();
  if (selErr || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // phase 2: update
  const { data, error } = await supabase.from("Leads").update({ note }).eq("id", id).select("note").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, note: data.note });
}
