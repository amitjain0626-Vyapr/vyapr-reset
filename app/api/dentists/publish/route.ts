// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/* ---------- helpers ---------- */
function jerr(status: number, code: string, msg: string, details?: any) {
  return NextResponse.json({ ok: false, error: { code, message: msg, details } }, { status });
}

function parseBody(obj: any) {
  // Map UI "city" -> DB "location"
  const location = (obj?.location || obj?.city || "").toString().trim();
  const out = {
    name: (obj?.name || "").toString().trim(),
    phone: (obj?.phone || "").toString().trim(),
    location, // DB column
    category: (obj?.category || "").toString().trim(),
    slug: obj?.slug ? obj.slug.toString().trim().toLowerCase() : "",
    publish: Boolean(obj?.publish ?? true), // will map to microsites.is_live
  };
  const missing: string[] = [];
  if (!out.name) missing.push("name");
  if (!out.phone) missing.push("phone");
  if (!out.category) missing.push("category");
  return { out, missing };
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 48);
}

async function ensureUniqueSlug(supabase: any, base: string) {
  let cand = base || "site";
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase.from("microsites").select("id").eq("slug", cand).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return cand;
    cand = `${base}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 58);
  }
  throw new Error("slug_unavailable");
}

/* ---------- route ---------- */
export async function POST(req: Request) {
  try {
    // Cookie-based Supabase (no bearer header needed)
    const supabase = createRouteHandlerClient({ cookies });

    // 1) Auth guard
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jerr(401, "unauthorized", "Please sign in to continue.", userErr?.message || null);

    // 2) Parse input
    let payload: any;
    try { payload = await req.json(); } catch { return jerr(400, "bad_json", "Invalid JSON body."); }
    const { out, missing } = parseBody(payload);
    if (missing.length) return jerr(422, "validation_error", `Missing: ${missing.join(", ")}`);

    // 3) Idempotent read (match your schema)
    const { data: existing, error: selErr } = await supabase
      .from("providers")
      .select("id, owner_id, name, phone, location, category, slug, published")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (selErr) return jerr(500, "select_provider_failed", "Failed to read provider.", selErr.message || selErr);

    if (existing) {
      // Patch provider (use `location`)
      const patch: any = {};
      if (out.name && out.name !== existing.name) patch.name = out.name;
      if (out.phone && out.phone !== existing.phone) patch.phone = out.phone;
      if (out.location !== undefined && out.location !== (existing.location || "")) patch.location = out.location || null;
      if (out.category && out.category !== existing.category) patch.category = out.category;
      if (Object.keys(patch).length) {
        const { error: upErr } = await supabase.from("providers").update(patch).eq("id", existing.id);
        if (upErr) return jerr(500, "provider_update_failed", "Could not update provider.", upErr.message || upErr);
      }

      // Ensure microsite (uses `is_live`)
      const { data: ms, error: msSelErr } = await supabase
        .from("microsites")
        .select("id, slug, is_live")
        .eq("owner_id", user.id)
        .eq("provider_id", existing.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (msSelErr) return jerr(500, "microsite_select_failed", "Failed to read microsite.", msSelErr.message || msSelErr);

      let finalSlug = ms?.slug;
      if (!ms) {
        const desired = out.slug || toSlug(out.name);
        finalSlug = await ensureUniqueSlug(supabase, desired);
        const { error: msInsErr } = await supabase.from("microsites").insert({
          owner_id: user.id,
          provider_id: existing.id,
          slug: finalSlug,
          is_live: Boolean(out.publish),
        });
        if (msInsErr) return jerr(500, "microsite_create_failed", "Could not create microsite.", msInsErr.message || msInsErr);
      } else if (out.publish && !ms.is_live) {
        const { error: msPubErr } = await supabase.from("microsites").update({ is_live: true }).eq("id", ms.id);
        if (msPubErr) return jerr(500, "microsite_publish_failed", "Could not publish microsite.", msPubErr.message || msPubErr);
      }

      // best-effort telemetry
      await supabase.from("events").insert({
        type: "provider_published",
        person_id: null,
        provider_id: existing.id,
        meta: { source: "onboarding/update" },
      });

      return NextResponse.json({
        ok: true,
        provider_id: existing.id,
        slug: finalSlug,
        redirectTo: `/dashboard?slug=${finalSlug}`,
      });
    }

    // 4) Create provider + microsite (match schema)
    const { data: prov, error: pErr } = await supabase
      .from("providers")
      .insert({
        owner_id: user.id,
        name: out.name,
        phone: out.phone,
        location: out.location || null,  // <— schema uses location
        category: out.category,          // (category exists in your table)
        verified: false,
        // published is optional; keep default
      })
      .select("id")
      .single();
    if (pErr) return jerr(500, "provider_create_failed", "Could not create provider.", pErr.message || pErr);

    const desired = out.slug || toSlug(out.name);
    const finalSlug = await ensureUniqueSlug(supabase, desired);
    const { error: msErr } = await supabase.from("microsites").insert({
      owner_id: user.id,
      provider_id: prov.id,
      slug: finalSlug,
      is_live: Boolean(out.publish), // <— schema uses is_live
    });
    if (msErr) return jerr(500, "microsite_create_failed", "Could not create microsite.", msErr.message || msErr);

    // best-effort telemetry
    await supabase.from("events").insert({
      type: "provider_published",
      person_id: null,
      provider_id: prov.id,
      meta: { source: "onboarding/new" },
    });

    return NextResponse.json({
      ok: true,
      provider_id: prov.id,
      slug: finalSlug,
      redirectTo: `/dashboard?slug=${finalSlug}`,
    });
  } catch (e: any) {
    return jerr(500, "unexpected", "Unexpected error (debug).", e?.stack || e?.message || String(e));
  }
}
