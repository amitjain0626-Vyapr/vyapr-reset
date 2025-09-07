// app/api/verification/status/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get("slug") || "").trim();
    const id = (searchParams.get("provider_id") || "").trim();

    const sb = admin();

    // Resolve provider_id by slug (if not passed)
    let provider_id: string | null = id || null;
    if (!provider_id) {
      const { data: prov, error: e1 } = await sb
        .from("Providers")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 400 });
      provider_id = prov?.id || null;
    }
    if (!provider_id) {
      // Keep success response but unverified if provider not found (fail-open UI)
      return NextResponse.json({ ok: true, verified: false, method: "none", referrals: 0, reason: "provider_not_found" });
    }

    // Verified if there exists at least one provider.verified event
    const { data: vrows = [], error: e2 } = await sb
      .from("Events")
      .select("id")
      .eq("provider_id", provider_id)
      .eq("event", "provider.verified")
      .limit(1);
    if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 400 });

    const verified = vrows.length > 0;

    // Infer method (doc/admin) from existing events without adding columns (no schema drift)
    const { data: mrows = [], error: e3 } = await sb
      .from("Events")
      .select("event")
      .eq("provider_id", provider_id)
      .in("event", ["verification.doc.submitted", "verification.doc.approved", "provider.verified", "referral.accepted", "referral.used"]);
    if (e3) return NextResponse.json({ ok: false, error: e3.message }, { status: 400 });

    const method: "none" | "doc_or_admin" | "referral" =
      mrows.some((r: any) => r?.event === "verification.doc.submitted" || r?.event === "verification.doc.approved")
        ? "doc_or_admin"
        : "none";

    // Count referrals via existing telemetry names if present (safe default = 0)
    const referrals = mrows.filter((r: any) => r?.event === "referral.accepted" || r?.event === "referral.used").length;

    return NextResponse.json({
      ok: true,
      provider_id,
      verified,
      method,
      referrals,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "status_failed" }, { status: 500 });
  }
}
