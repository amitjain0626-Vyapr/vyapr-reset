import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../lib/supabase/server";

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    return NextResponse.json({
      ok: true,
      supabase: !error,
      user: Boolean(user),
      time: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
