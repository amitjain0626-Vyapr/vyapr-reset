
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

  const nextNote =
    note === null || note === undefined ? null : String(note).slice(0, 5000);

  const supabase = createSupabaseServerClient();

  // Must be authenticated
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Phase 1: verify the row is visible under RLS (owner_id = auth.uid())
  const { data: exists, error: selErr } = await supabase
    .from("Leads")
    .select("id, note")
    .eq("id", id)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json(
      { error: "Forbidden or query error (select)", details: selErr.message },
      { status: 403 }
    );
  }
  if (!exists) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Phase 2: perform the update and return the new value
  const { data: updated, error: updErr } = await supabase
    .from("Leads")
    .update({ note: nextNote })
    .eq("id", id)
    .select("id, note")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json(
      { error: "Forbidden or query error (update)", details: updErr.message },
      { status: 403 }
    );
  }

  const finalNote = updated?.note ?? nextNote;
  return NextResponse.json({ ok: true, id: exists.id, note: finalNote }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
TS
