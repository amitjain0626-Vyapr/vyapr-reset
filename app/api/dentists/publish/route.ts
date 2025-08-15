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

async function ensureUniqueSlug(admin: any, base: string, ignoreProviderId?: string | null) {
  const reserved = new Set(["api", "auth", "d", "_next", "static"]);
  let candidate = base || "site";
  if (reserved.has(candidate)) candidate = "site";

  let attempt = 1;
  while (true) {
    const slug = attempt === 1 ? candidate : `${candidate}-${attempt}`;
    // Check providers.slug and microsites.slug, excluding the current provider (if any)
    const { data: p } = await admin
      .from("providers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    const { data: m } = await admin
      .from("microsites")
      .select("provider_id")
      .eq("slug", slug)
      .maybeSingle();

    const takenByOtherProvider =
      (p && (!ignoreProviderId || p.id !== ignoreProviderId)) ||
      (m && (!ignoreProviderId || m.provider_id !== ignoreProviderId));

    if (!takenByOtherProvider) return slug;
    attempt++;
  }
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies }); // reads/writes session cookies
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
  let slugInput = String(body.slug || "").trim();

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: "Missing required fields: name, phone" }, { status: 400 });
  }
  if (!slugInput) slugInput = slugify(name);

  // 3) Find or create provider (no onConflict assumptions)
  // a) Try by owner_id
  let provider: any = null;
  {
    const { data } = await admin
      .from("providers")
      .select("id, slug")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (data) provider = data;
  }

  // b) If not found, try by incoming slug
  if (!provider) {
    const { data } = await admin
      .from("providers")
      .select("id, slug")
      .eq("slug", slugInput)
      .maybeSingle();
    if (data) provider = data;
  }

  // c) Ensure a UNIQUE slug for this provider
  const uniqueSlug = await ensureUniqueSlug(admin, slugify(slugInput), provider?.id || null);

  // d) Insert or update provider
  if (!provider) {
    const { data, error } = await admin
      .from("providers")
      .insert({ owner_id: user.id, name, phone, category, slug: uniqueSlug })
      .select("id, slug")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "provider insert failed" }, { status: 400 });
    }
    provider = data;
  } else {
    const { data, error } = await admin
      .from("providers")
      .update({ name, phone, category, slug: uniqueSlug })
      .eq("id", provider.id)
      .select("id, slug")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "provider update failed" }, { status: 400 });
    }
    provider = data;
  }

  // 4) Ensure microsite exists and has owner_id (NOT NULL) + slug in sync
  const { data: ms } = await admin
    .from("microsites")
    .select("provider_id, slug, owner_id")
    .eq("provider_id", provider.id)
    .maybeSingle();

  if (!ms) {
    const { error } = await admin
      .from("microsites")
      .insert({ provider_id: provider.id, owner_id: user.id, slug: uniqueSlug });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || "microsite insert failed" }, { status: 400 });
    }
  } else {
    // Repair legacy rows missing owner_id; keep slug in sync with provider
    const patch: any = {};
    if (!ms.owner_id) patch.owner_id = user.id;
    if (ms.slug !== uniqueSlug) patch.slug = uniqueSlug;

    if (Object.keys(patch).length > 0) {
      const { error } = await admin
        .from("microsites")
        .update(patch)
        .eq("provider_id", provider.id);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message || "microsite update failed" }, { status: 400 });
      }
    }
  }

  // 5) Telemetry (non‑blocking)
  await admin.from("events").insert({
    type: "provider_published",
    provider_id: provider.id,
    ts: new Date().toISOString(),
    meta: { slug: uniqueSlug, source: "publish-api" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, provider_id: provider.id, slug: provider.slug });
}
