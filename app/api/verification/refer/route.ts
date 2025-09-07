// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function providerBySlug(slug: string) {
  const sb = admin();
  const { data, error } = await sb.from("Providers").select("id, slug").eq("slug", slug).maybeSingle();
  if (error || !data?.id) throw new Error("provider_not_found");
  return data as { id: string; slug: string };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = (body.slug || "").trim();
    const referrer = (body.referrer || "").toString().trim();
    if (!slug || !referrer) return NextResponse.json({ ok: false, error: "missing_slug_or_referrer" }, { status: 400 });

    const provider = await providerBySlug(slug);
    const sb = admin();
    const ts = Date.now();

    // log referral
    const { error } = await sb
      .from("Events")
      .insert({ event: "verification.referral.received", ts, provider_id: provider.id, lead_id: null, source: { referrer } });
    if (error) throw error;

    // Count total referrals
    const { count } = await sb
      .from("Events")
      .select("*", { count: "exact", head: true })
      .eq("provider_id", provider.id)
      .eq("event", "verification.referral.received");

    let approved = false;
    if ((count || 0) >= 2) {
      await sb.from("Events").insert({ event: "verification.approved", ts: Date.now(), provider_id: provider.id, lead_id: null, source: { method: "referral", count } });
      approved = true;
    }

    return NextResponse.json({ ok: true, provider_id: provider.id, referrals: count || 1, approved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
