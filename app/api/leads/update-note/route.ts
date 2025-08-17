// app/api/leads/update-note/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUUIDv4(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function handle(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { id, note } = body || {};
  if (!isUUIDv4(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // normalize & clamp note
  const nextNote =
    note === null || note === undefined ? null : String(note).slice(0, 5000);

  const supabase = createSupabaseServerClient();

  // must be authenticated (required for RLS)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS ensures only owner_id = auth.uid() can update
  const { data, error } = await supabase
    .from("Leads")
    .update({ note: nextNote })
    .eq("id", id)
    .select("id, note")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Forbidden or query error", details: error.message },
      { status: 403 }
    );
  }

  if (!data) {
    // no row matched (id wrong or blocked by RLS — but those would have errored above)
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: data.id, note: data.note }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  return handle(req);
}

// Optional: keep POST compatibility if your UI still uses POST.
export async function POST(req: NextRequest) {
  return handle(req);
}
