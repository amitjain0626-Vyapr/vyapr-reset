// app/api/leads/history/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/leads/history?id=<lead_id>
 * Returns history rows for a lead if the signed-in user owns the lead.
 */
export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing lead id" }, { status: 400 });
    }

    // Auth check
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // Verify ownership: the lead must belong to a provider whose owner_id = user.id
    const { data: lead, error: leadErr } = await supabase
      .from("Leads")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }
    if (lead.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from("LeadHistory")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "Unexpected error" }, { status: 500 });
  }
}
