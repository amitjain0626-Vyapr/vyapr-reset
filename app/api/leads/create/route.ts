// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    patient_name,
    phone,
    status = "new",
    source = "microsite",
    note = null,
    slug = null,            // 👈 allow microsite slug to come from form
  } = body || {};

  // 1) Look up provider by slug + owner
  let providerId: string | null = null;
  if (slug) {
    const { data: provider, error: provErr } = await supabase
      .from("Providers")
      .select("id")
      .eq("slug", slug)
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (provErr) {
      return NextResponse.json({ error: provErr.message }, { status: 400 });
    }
    providerId = provider?.id ?? null;
  }

  // 2) Insert lead linked to provider_id
  const { data, error } = await supabase
    .from("Leads")
    .insert({
      patient_name,
      phone,
      status,
      source,
      note,
      provider_id: providerId,   // ✅ new FK
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, lead: data });
}
