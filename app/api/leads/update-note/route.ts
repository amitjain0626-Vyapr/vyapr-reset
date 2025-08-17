// app/api/leads/update-note/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/leads/update-note
 * body: { id: string, note: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { id, note } = await req.json().catch(() => ({}));

    if (!id || typeof note !== "string") {
      return NextResponse.json({ ok: false, error: "Missing id or note" }, { status: 400 });
    }

    // auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // fetch current lead (ownership check + old note for history)
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, owner_id, note")
      .eq("id", id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }
    if (lead.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // update note
    const { data: updated, error: updErr } = await supabase
      .from("leads")
      .update({ note })
      .eq("id", id)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    // write history row (best-effort: ignore error if table missing)
    try {
      await supabase.from("lead_history").insert([
        {
          lead_id: id,
          action: "note_update",
          old_value: lead.note ?? "",
          new_value: note,
          actor: user.id,
        },
      ]);
    } catch { /* ignore history failures */ }

    return NextResponse.json({ ok: true, lead: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Unexpected error" }, { status: 500 });
  }
}
