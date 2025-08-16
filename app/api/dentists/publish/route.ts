// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Simple body validator (no zod to keep deps light)
function parseBody(obj: any) {
  const out = {
    name: (obj?.name || "").toString().trim(),
    phone: (obj?.phone || "").toString().trim(),
    city: (obj?.city || "").toString().trim(),
    category: (obj?.category || "").toString().trim(),
    slug: obj?.slug ? obj.slug.toString().trim().toLowerCase() : "",
    publish: Boolean(obj?.publish ?? true),
  };
  const missing = [];
  if (!out.name) missing.push("name");
  if (!out.phone) missing.push("phone");
  if (!out.category) missing.push("category");
  // city is optional for now, we accept empty
  return { out, missing };
}

function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

async function ensureUniqueSlug(supabase: any, baseSlug: string) {
  let candidate = baseSlug || "site";
  // Check collisions and retry with suffix
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from("microsites")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    // add short suffix
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${baseSlug}-${suffix}`.slice(0, 58);
  }
  throw new Error("slug_unavailable");
}

function jsonError(status: number, code: string, message: string, extra?: any) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, ...(extra ? { extra } : {}) },
    },
    { status }
  );
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  // 1) Auth guard
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return jsonError(401, "unauthorized", "Please sign in to continue.");
  }
  const user = userRes.user;

  // 2) Parse input
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_json", "Invalid JSON body.");
  }
  const { out, missing } = parseBody(body);
  if (missing.length) {
    return jsonError(422, "validation_error", `Missing: ${missing.join(", ")}`);
  }

  // 3) If provider already exists for this owner, return it (idempotent)
  //    Uses your RLS policy: owner_id = auth.uid()
  const { data: existingProvider, error: selErr } = await supabase
    .from("providers")
    .select("id, owner_id, display_name, phone, city, category")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    // If RLS blocked or function misbehaved, surface clearly
    return jsonError(500, "select_provider_failed", "Failed to read provider.", {
      details: selErr.message ?? selErr,
    });
  }

  if (existingProvider) {
    // Optionally update fields from the form (safe, partial)
    const patch: any = {};
    if (out.name && out.name !== existingProvider.display_name) patch.display_name = out.name;
    if (out.phone && out.phone !== existingProvider.phone) patch.phone = out.phone;
    if (out.city !== undefined && out.city !== existingProvider.city) patch.city = out.city || null;
    if (out.category && out.category !== existingProvider.category) patch.category = out.category;

    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase
        .from("providers")
        .update(patch)
        .eq("id", existingProvider.id);
      if (upErr) {
        return jsonError(500, "provider_update_failed", "Could not update provider.", {
          details: upErr.message ?? upErr,
        });
      }
    }

    // Ensure microsite exists for this provider; if not, create it
    const { data: msExisting, error: msSelErr } = await supabase
      .from("microsites")
      .select("id, slug, published")
      .eq("owner_id", user.id)
      .eq("provider_id", existingProvider.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msSelErr) {
      return jsonError(500, "microsite_select_failed", "Failed to read microsite.", {
        details: msSelErr.message ?? msSelErr,
      });
    }

    let finalSlug = msExisting?.slug;
    if (!msExisting) {
      const desired = out.slug || toSlug(out.name);
      finalSlug = await ensureUniqueSlug(supabase, desired);
      const { error: msInsErr } = await supabase.from("microsites").insert({
        owner_id: user.id,
        provider_id: existingProvider.id,
        slug: finalSlug,
        published: Boolean(out.publish),
      });
      if (msInsErr) {
        return jsonError(500, "microsite_create_failed", "Could not create microsite.", {
          details: msInsErr.message ?? msInsErr,
        });
      }
    } else if (out.publish && msExisting && msExisting.published !== true) {
      const { error: msPubErr } = await supabase
        .from("microsites")
        .update({ published: true })
        .eq("id", msExisting.id);
      if (msPubErr) {
        return jsonError(500, "microsite_publish_failed", "Could not publish microsite.", {
          details: msPubErr.message ?? msPubErr,
        });
      }
    }

    // Telemetry (best-effort, non-blocking)
    await supabase.from("events").insert({
      type: "provider_published",
      person_id: null,
      provider_id: existingProvider.id,
      meta: { source: "onboarding/update" },
    });

    return NextResponse.json({
      ok: true,
      provider_id: existingProvider.id,
      slug: finalSlug,
      redirectTo: `/dashboard?slug=${finalSlug}`,
    });
  }

  // 4) No provider yet → create provider & microsite
  try {
    // Create provider (RLS: owner_id must equal auth.uid())
    const { data: prov, error: pErr } = await supabase
      .from("providers")
      .insert({
        owner_id: user.id,
        display_name: out.name,
        phone: out.phone,
        city: out.city || null,
        category: out.category,
        verified: false,
      })
      .select("id")
      .single();

    if (pErr) {
      // Unique index on owner_id will throw 23505 if racing — treat as conflict and re-read
      if (pErr.code === "23505") {
        const { data: prov2, error: sel2Err } = await supabase
          .from("providers")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sel2Err || !prov2) {
          return jsonError(409, "provider_conflict", "A provider already exists but couldn't be retrieved.", {
            details: (sel2Err && sel2Err.message) || null,
          });
        }
        // Fall through using prov2.id
        const desired = out.slug || toSlug(out.name);
        const finalSlug = await ensureUniqueSlug(supabase, desired);
        const { error: msInsErr } = await supabase.from("microsites").insert({
          owner_id: user.id,
          provider_id: prov2.id,
          slug: finalSlug,
          published: Boolean(out.publish),
        });
        if (msInsErr) {
          return jsonError(500, "microsite_create_failed", "Could not create microsite.", {
            details: msInsErr.message ?? msInsErr,
          });
        }
        await supabase.from("events").insert({
          type: "provider_published",
          person_id: null,
          provider_id: prov2.id,
          meta: { source: "onboarding/race_recover" },
        });
        return NextResponse.json({
          ok: true,
          provider_id: prov2.id,
          slug: finalSlug,
          redirectTo: `/dashboard?slug=${finalSlug}`,
        });
      }
      return jsonError(500, "provider_create_failed", "Could not create provider.", {
        details: pErr.message ?? pErr,
      });
    }

    // Create microsite
    const desired = out.slug || toSlug(out.name);
    const finalSlug = await ensureUniqueSlug(supabase, desired);

    const { error: msErr } = await supabase.from("microsites").insert({
      owner_id: user.id,
      provider_id: prov.id,
      slug: finalSlug,
      published: Boolean(out.publish),
    });
    if (msErr) {
      return jsonError(500, "microsite_create_failed", "Could not create microsite.", {
        details: msErr.message ?? msErr,
      });
    }

    // Telemetry (best-effort)
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
    // Catch-all
    return jsonError(500, "unexpected", "Unexpected error.", {
      details: e?.message || String(e),
    });
  }
}
