// app/api/leads/create/route.ts
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) || {};
  const provider_slug = (body.provider_slug || "").trim();
  const patient_name = body.patient_name || null;
  const phone = body.phone || null;
  const note = body.note || null;

  // Try session first
  const sbUser = createSupabaseServerClient();
  const { data: auth } = await sbUser.auth.getUser();

  let sb: any = sbUser;
  let provider_id: string | null = null;

  if (auth?.user?.id) {
    provider_id = auth.user.id;
  } else {
    if (!provider_slug) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
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

  // Insert Lead as "unverified"
  const insert = {
    provider_id,
    patient_name,
    phone,
    note,
    status: "unverified",
    source: { via: "api", hint: "manual" },
  };

  const { data, error } = await sb.from("Leads").insert(insert).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // telemetry (best-effort)
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app";
  fetch(`${base}/api/events/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "lead.imported",
      provider_id,
      lead_id: data.id,
      source: { from: "api", note },
    }),
    keepalive: true,
  }).catch(() => {});

  return NextResponse.json({ ok: true, lead_id: data.id });
}
