// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";          // force Node runtime
export const dynamic = "force-dynamic";   // no cache
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/debug/leads-sanity?slug=<provider-slug>&limit=5
 * Returns: session user, provider(owner_id, published), and leads visible under RLS.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = String(url.searchParams.get("slug") || "").trim();
    const limit = Number(url.searchParams.get("limit") || 5);

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // who am I?
    const { data: authData } = await supabase.auth.getUser();
    const user_id = authData?.user?.id || null;
    const user_email = authData?.user?.email || null;

    // provider row (we need owner_id + published to reason about RLS & RPC)
    const { data: provider, error: pErr } = await supabase
      .from("Providers")
      .select("id, owner_id, slug, published")
      .eq("slug", slug)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({
        ok: false,
        error: "providers_select_failed",
        details: String(pErr.message || pErr),
        user: { user_id, user_email },
      }, { status: 500 });
    }

    if (!provider) {
      return NextResponse.json({
        ok: false,
        error: "provider_not_found",
        slug,
        user: { user_id, user_email },
      }, { status: 404 });
    }

    // leads count visible to current session (RLS)
    const { count, error: cErr } = await supabase
      .from("Leads")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", provider.id);

    const { data: sample, error: sErr } = await supabase
      .from("Leads")
      .select("id, patient_name, phone, status, created_at")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(isNaN(limit) ? 5 : limit);

    return NextResponse.json({
      ok: true,
      user: { user_id, user_email },
      provider, // { id, owner_id, slug, published }
      leads: {
        count: cErr ? null : (count ?? 0),
        sample_error: sErr ? String(sErr.message || sErr) : null,
        sample: sample ?? [],
      },
      hints: [
        "If provider.published=false, public lead inserts via /api/leads/create are rejected.",
        "If provider.owner_id !== user.user_id, RLS will hide leads on /dashboard/leads.",
        "If count=0 but you posted to /api/leads/create, check the slug you used in the POST.",
      ],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
