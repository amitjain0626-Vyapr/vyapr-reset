// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

type Body = { id?: string; status?: string };
const ALLOWED = new Set(["new", "contacted", "booked", "closed", "spam"]);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as Body;
    const id = (body.id || "").trim();
    const status = (body.status || "").trim().toLowerCase();
    if (!id || !ALLOWED.has(status)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: dentist, error: dErr } = await supabase
      .from("Dentists")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (dErr || !dentist) {
      return NextResponse.json({ error: "No dentist profile" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("Leads")
      .update({ status })
      .eq("id", id)
      .eq("dentist_id", dentist.id)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
