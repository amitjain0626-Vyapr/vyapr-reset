// app/api/leads/list/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider_slug = (searchParams.get("provider_slug") || "").trim();
  const status = (searchParams.get("status") || "").trim(); // optional filter

  // 1) Try session (original behavior)
  const sbUser = createSupabaseServerClient();
  const { data: auth } = await sbUser.auth.getUser();

  let sb: any = sbUser;
  let provider_id: string | null = null;

  if (auth?.user?.id) {
    provider_id = auth.user.id;
  }

  // 2) If no session, but slug is provided → resolve via admin
  if (!provider_id && provider_slug) {
    const { data: prov, error: e1 } = await admin()
      .from("Providers")
      .select("id")
      .eq("slug", provider_slug)
      .maybeSingle();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!prov?.id) return NextResponse.json({ error: "provider_not_found" }, { status: 404 });

    provider_id = prov.id;
    sb = admin();
  }

  if (!provider_id) {
    // preserve old behavior for callers without slug
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let q = sb
    .from("Leads")
    .select("id, patient_name, phone, status, source, created_at, note")
    .eq("provider_id", provider_id)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, leads: data ?? [] });
}
