// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user || null;

    if (!user) {
      return NextResponse.json({
        ok: true,
        user: null,
        note: "No active session. You are not logged in for server requests.",
      });
    }

    // List providers owned by this user (slugs only)
    const { data: providers, error } = await supabase
      .from("Providers")
      .select("id, slug, published")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
      },
      owned_providers: providers || [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
