// @ts-nocheck
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function jerr(status: number, code: string, message: string, meta: any = {}) {
  const metaOut: any = { ...meta };
  const err =
    meta?.error ||
    meta?.upsertErr ||
    meta?.existErr ||
    meta?.microErr ||
    meta?.userErr;
  if (err) {
    metaOut.code = err.code || err.name;
    metaOut.details = err.details || err.message || String(err);
    metaOut.hint = err.hint ?? undefined;
    metaOut.msg = err.message ?? undefined;
  }
  return json({ ok: false, error: { code, message }, meta: metaOut }, status);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Required (keep lean to avoid schema mismatches)
    for (const k of ["name", "phone", "category", "slug"] as const) {
      if (!body?.[k] || String(body[k]).trim() === "") {
        return jerr(400, "VALIDATION_FAILED", `Missing field: ${k}`);
      }
    }

    const supabase = getSupabaseServer();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return jerr(401, "AUTH_USER_ERROR", "Unable to read session user.", { userErr });
    if (!user) return jerr(401, "UNAUTHENTICATED", "No active session. Please sign in again.");

    const PROVIDERS = "providers";
    const MICROSITES = "microsites";
    const EVENTS = "events";

    // Check/adjust slug
    const { data: existing, error: existErr } = await supabase
      .from(PROVIDERS)
      .select("id, slug")
      .eq("slug", body.slug)
      .limit(1)
      .maybeSingle();
    if (existErr) return jerr(500, "SLUG_CHECK_FAILED", "Failed checking slug.", { existErr });

    let finalSlug = body.slug;
    if (existing) finalSlug = `${body.slug}-${Math.random().toString(36).slice(2, 6)}`;

    // Provider upsert (minimal payload)
    const providerPayload = {
      owner_id: user.id,
      name: body.name,
      phone: body.phone,
      category: body.category,
      slug: finalSlug,
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from(PROVIDERS)
      .upsert(providerPayload, { onConflict: "slug" })
      .select("id, slug")
      .single();

    if (upsertErr) {
      return jerr(400, "UPSERT_FAILED", "Could not publish provider.", {
        upsertErr,
        providerPayload,
      });
    }

    // Microsite upsert (1:1 by provider_id)
    const { error: microErr } = await supabase
      .from(MICROSITES)
      .upsert(
        {
          owner_id: user.id,
          provider_id: upserted.id,
          slug: upserted.slug,
          is_live: true,
        },
        { onConflict: "provider_id" }
      );
    if (microErr) return jerr(500, "MICROSITE_UPSERT_FAILED", "Microsite creation failed.", { microErr });

    // ✅ Telemetry: record publish success (best-effort; never block)
    try {
      await supabase.from(EVENTS).insert({
        provider_id: upserted.id,
        type: "provider_published",
        meta: {
          slug: upserted.slug,
          source: "onboarding",
          category: body.category ?? null,
          city: body.city ?? null,
        },
      });
    } catch (telemetryErr) {
      console.log("[publish] telemetry insert failed", telemetryErr);
    }

    return json({
      ok: true,
      provider_id: upserted.id,
      slug: upserted.slug,
      redirect: `/dashboard?slug=${upserted.slug}`,
    });
  } catch (e: any) {
    return jerr(500, "UNHANDLED", "Unexpected server error.", { message: e?.message });
  }
}
