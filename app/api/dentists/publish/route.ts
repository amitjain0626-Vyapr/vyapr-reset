// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createAdminClient } from "@/lib/supabaseAdmin";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const admin = createAdminClient();

  // 1) Auth required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "AUTH_USER_ERROR", message: "Unable to read session user.", details: "Auth session missing!" },
      { status: 401 }
    );
  }

  // 2) Parse body
  let body: any = {};
  try { body = await req.json(); } catch {}
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const category = String(body.category || "").trim();
  let slug = String(body.slug || "").trim();

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: "Missing required fields: name, phone" }, { status: 400 });
  }
  if (!slug) slug = slugify(name);

  // 3) Upsert PROVIDER without relying on unique constraints
  // Try find by owner first, else by slug, else create.
  let provider = null as any;

  // a) by owner_id
  {
    const { data } = await admin
      .from("providers")
      .select("id, slug")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (data) provider = data;
  }

  // b) if not found, try by slug
  if (!provider) {
    const { data } = await admin
      .from("providers")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();
    if (data) provider = data;
  }

  // c) insert or update
  if (!provider) {
    const { data, error } = await admin
      .from("providers")
      .insert({ owner_id: user.id, name, phone, category, slug })
      .select("id, slug")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "provider insert failed" }, { status: 400 });
    }
    provider = data;
  } else {
    const { data, error } = await admin
      .from("providers")
      .update({ name, phone, category, slug })
      .eq("id", provider.id)
      .select("id, slug")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "provider update failed" }, { status: 400 });
    }
    provider = data;
  }

  // 4) Ensure MICROSITE (one per provider). Avoid onConflict; do select -> insert/update.
  const { data: ms } = await admin
    .from("microsites")
    .select("provider_id, slug")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!ms) {
    const { error } = await admin
      .from("microsites")
      .insert({ provider_id: provider.id, slug });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "microsite insert failed" }, { status: 400 });
    }
  } else if (ms.slug !== slug) {
    const { error } = await admin
      .from("microsites")
      .update({ slug })
      .eq("provider_id", provider.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "microsite update failed" }, { status: 400 });
    }
  }

  // 5) Telemetry (non-blocking)
  await admin.from("events").insert({
    type: "provider_published",
    provider_id: provider.id,
    ts: new Date().toISOString(),
    meta: { slug, source: "publish-api" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, provider_id: provider.id, slug: provider.slug });
}
