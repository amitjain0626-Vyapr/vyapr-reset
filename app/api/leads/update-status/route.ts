// app/api/leads/update-status/route.ts
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

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = body?.id || body?.lead_id;
  const status = body?.status;
  const provider_slug = body?.provider_slug || null;

  if (!id || !status) {
    return NextResponse.json(
      { error: "Missing id or status" },
      { status: 400 }
    );
  }

  // try auth user first
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  let sb: any = supabase;
  let provider_id: string | null = null;

  if (!auth?.user) {
    // fallback to admin with provider_slug
    if (!provider_slug)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: provider } = await admin()
      .from("Providers")
      .select("id")
      .eq("slug", provider_slug)
      .maybeSingle();

    provider_id = provider?.id || null;
    sb = admin();
  } else {
    provider_id = auth.user.id;
  }

  const { error } = await sb.from("Leads").update({ status }).eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  // telemetry
  const event =
    status === "verified"
      ? "lead.verified"
      : status === "discarded"
      ? "lead.discarded"
      : "lead.updated";

  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/events/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      lead_id: id,
      provider_id,
      source: { status },
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
