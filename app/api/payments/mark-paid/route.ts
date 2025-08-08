// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

type Body = { id?: string };

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as Body;
    const id = (body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: dentist } = await supabase
      .from("Dentists")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!dentist) return NextResponse.json({ error: "No dentist profile" }, { status: 400 });

    const { data: payment } = await supabase
      .from("Payments")
      .select("id")
      .eq("id", id)
      .eq("dentist_id", dentist.id)
      .maybeSingle();
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    const { error: upErr } = await supabase
      .from("Payments")
      .update({ status: "paid" })
      .eq("id", id)
      .eq("dentist_id", dentist.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
