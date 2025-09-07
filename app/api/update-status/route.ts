// app/api/leads/update-status/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const id = body?.id || body?.lead_id;
  const status = body?.status;

  if (!id || !status)
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

  const { error } = await supabase.from("Leads").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 🔥 Telemetry: log lead.verified / lead.discarded
  const event =
    status === "verified"
      ? "lead.verified"
      : status === "discarded"
      ? "lead.discarded"
      : "lead.updated";
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/events/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, lead_id: id, source: { status } }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
