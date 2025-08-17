// app/api/leads/update-status/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "id and status required" }, { status: 400 });
    }

    const supabase = createClient();

    // must be signed in
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // find provider owned by this user
    const { data: prov, error: provErr } = await supabase
      .from("providers")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (provErr || !prov) {
      return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });
    }

    // update only if the lead belongs to this provider
    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .eq("dentist_id", prov.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: "Update failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
