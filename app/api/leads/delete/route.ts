// app/api/leads/delete/route.ts
import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "ID_REQUIRED" }, { status: 400 });

    const { error } = await supabase
      .from("Leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id); // double guard; RLS also enforces

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "UNKNOWN" }, { status: 500 });
  }
}
