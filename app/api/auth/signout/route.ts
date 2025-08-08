// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

export async function POST() {
  try {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.signOut();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
