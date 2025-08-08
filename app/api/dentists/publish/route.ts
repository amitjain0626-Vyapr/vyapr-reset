// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

type Body = { slug?: string };

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const slug = (body.slug || "").toLowerCase().trim();
    if (!slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    const { data: dentist, error: dErr } = await supabase
      .from("Dentists")
      .select(
        "id, user_id, name, email, phone, slug, about, city, state, pincode, profile_image_url, clinic_image_url, is_published"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (dErr || !dentist) {
      return NextResponse.json({ error: "No dentist profile found" }, { status: 400 });
    }

    const missing: string[] = [];
    if (!dentist.name) missing.push("name");
    if (!dentist.slug) missing.push("slug");
    if (!dentist.city) missing.push("city");
    if (!dentist.state) missing.push("state");
    if (dentist.slug !== slug) missing.push("slug_mismatch");
    if (missing.length) {
      return NextResponse.json({ error: "Missing fields", missing }, { status: 422 });
    }

    const { data: conflict } = await supabase
      .from("Dentists")
      .select("id")
      .neq("id", dentist.id)
      .eq("is_published", true)
      .ilike("slug", slug)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: "slug taken" }, { status: 409 });
    }

    const { data: updated, error: upErr } = await supabase
      .from("Dentists")
      .update({ is_published: true, slug })
      .eq("id", dentist.id)
      .select("id, slug, is_published")
      .maybeSingle();

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Publish failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, micrositePath: `/d/${updated.slug}` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
