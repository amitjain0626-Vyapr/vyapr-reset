// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createAdminClient } from "@/lib/supabaseAdmin";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 48);
}

async function ensureUniqueSlug(admin: any, base: string, ignoreProviderId?: string | null) {
  const reserved = new Set(["api", "auth", "d", "_next", "static"]);
  let candidate = base || "site";
  if (reserved.has(candidate)) candidate = "site";

  for (let attempt = 1; attempt < 200; attempt++) {
    const slug = attempt === 1 ? candidate : `${candidate}-${attempt}`;

    const { data: p, error: pErr } = await admin
      .from("providers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    const { data: m, error: mErr } = await admin
      .from("microsites")
      .select("provider_id")
      .eq("slug", slug)
      .maybeSingle();

    if (pErr || mErr) throw new Error(`slug_check_failed:${pErr?.message || ""} ${mErr?.message || ""}`.trim());

    const takenByOther =
      (p && (!ignoreProviderId || p.id !== ignoreProviderId)) ||
      (m && (!ignoreProviderId || m.provider_id !== ignoreProviderId));

    if (!takenByOther) return slug;
  }
  throw new Error("slug_generation_exhausted");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const admin = createAdminClient();

    // 1) Auth required
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw new Error(`auth_get_user_failed:${authErr.message}`);
    if (!user) return NextResponse.json(
      { ok: false, code: "AUTH_USER_ERROR", message: "Unable to read session user.", details: "Auth session missing!" },
      { status: 401 }
    );

    // 2) Parse input
    let body: any = {};
    try { body = await req.json(); } catch {}
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const category = String(body.category || "").trim();
    let slugInput = String(body.slug || "").trim();

    if (!name || !phone || !category) {
      return NextResponse.json({ ok: false, error: "Missing required fields: name, phone, category" }, { status: 400 });
    }
    if (!slugInput) slugInput = slugify(name);

    // 3) Find or create provider (no onConflict)
    let provider: any = null;

    // a) by owner_id
    {
      const { data, error } = await admin
        .from("providers")
        .select("id, slug")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw new Error(`providers_select_owner:${error.message}`);
      if (data) provider = data;
    }

    // b) by incoming slug
    if (!provider) {
      const { data, error } = await admin
        .from("providers")
        .select("id, slug")
        .eq("slug", slugInput)
        .maybeSingle();
      if (error) throw new Error(`providers_select_slug:${error.message}`);
      if (data) provider = data;
    }

    // c) get a unique slug
    const uniqueSlug = await ensureUniqueSlug(admin, slugify(slugInput), provider?.id || null);

    // d) insert or update provider
    if (!provider) {
      const { data, error } = await admin
        .from("providers")
        .insert({ owner_id: user.id, name, phone, category, slug: uniqueSlug })
        .select("id, slug")
        .maybeSingle();
      if (error || !data) throw new Error(`providers_insert:${error?.message || "no data"}`);
      provider = data;
    } else {
      const { data, error } = await admin
        .from("providers")
        .update({ name, phone, category, slug: uniqueSlug })
        .eq("id", provider.id)
        .select("id, slug")
        .maybeSingle();
      if (error || !data) throw new Error(`providers_update:${error?.message || "no data"}`);
      provider = data;
    }

    // 4) Ensure microsite (owner_id NOT NULL) in sync
    const { data: ms, error: msSelErr } = await admin
      .from("microsites")
      .select("provider_id, slug, owner_id")
      .eq("provider_id", provider.id)
      .maybeSingle();
    if (msSelErr) throw new Error(`microsites_select:${msSelErr.message}`);

    if (!ms) {
      const { error } = await admin
        .from("microsites")
        .insert({ provider_id: provider.id, owner_id: user.id, slug: uniqueSlug });
      if (error) throw new Error(`microsites_insert:${error.message}`);
    } else {
      const patch: any = {};
      if (!ms.owner_id) patch.owner_id = user.id;
      if (ms.slug !== uniqueSlug) patch.slug = uniqueSlug;
      if (Object.keys(patch).length > 0) {
        const { error } = await admin
          .from("microsites")
          .update(patch)
          .eq("provider_id", provider.id);
        if (error) throw new Error(`microsites_update:${error.message}`);
      }
    }

    // 5) Telemetry (non-blocking)
    await admin.from("events").insert({
      type: "provider_published",
      provider_id: provider.id,
      ts: new Date().toISOString(),
      meta: { slug: uniqueSlug, source: "publish-api" },
    }).catch((e: any) => {
      console.error("PUBLISH_EVT_FAIL", e?.message || e);
    });

    return NextResponse.json({ ok: true, provider_id: provider.id, slug: provider.slug });
  } catch (e: any) {
    console.error("PUBLISH_FAIL", e?.message || e);
    return NextResponse.json(
      { ok: false, error: e?.message || "internal_error" },
      { status: 500 }
    );
  }
}
