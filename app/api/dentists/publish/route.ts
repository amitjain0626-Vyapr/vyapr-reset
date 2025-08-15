// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies }); // <-- critical
  const admin = createAdminClient();

  // 1) Auth: must have user
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, code: "AUTH_USER_ERROR", message: "Unable to read session user.", details: "Auth session missing!" },
      { status: 401 }
    );
  }

  // 2) Parse body
  let body: any = {};
  try { body = await req.json(); } catch {}
  const {
    name = "", phone = "", category = "", // provider fields
    slug = "",                             // microsite slug
    // ...any other fields you already collect
  } = body;

  if (!name || !phone || !slug) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  // 3) Upsert provider tied to the logged-in user
  //    Your schema: providers(id, slug, category, owner_id, ...)
  const { data: prov, error: provErr } = await admin
    .from("providers")
    .upsert(
      { owner_id: user.id, name, phone, category, slug },
      { onConflict: "owner_id" }
    )
    .select("id, slug")
    .maybeSingle();

  if (provErr || !prov) {
    return NextResponse.json({ ok: false, error: provErr?.message || "provider upsert failed" }, { status: 400 });
  }

  // 4) Ensure microsite (unique per provider), your schema: microsites(provider_id, slug, ...)
  const { error: msErr } = await admin
    .from("microsites")
    .upsert({ provider_id: prov.id, slug }, { onConflict: "provider_id" });

  if (msErr) {
    return NextResponse.json({ ok: false, error: msErr.message || "microsite upsert failed" }, { status: 400 });
  }

  // 5) Telemetry (provider_published)
  const { error: evtErr } = await admin.from("events").insert({
    type: "provider_published",
    provider_id: prov.id,
    ts: new Date().toISOString(),
    meta: { slug, source: "publish-api" },
  });
  // Non‑blocking: ignore evtErr in response

  return NextResponse.json({ ok: true, provider_id: prov.id, slug: prov.slug });
}
