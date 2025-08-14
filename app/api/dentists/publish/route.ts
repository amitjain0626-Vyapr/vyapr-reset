// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function j(status: number, code: string, message: string, meta: any = {}) {
  // Flatten common Supabase error shapes for readability
  const metaOut: any = { ...meta };
  const err = meta?.error || meta?.upsertErr || meta?.existErr || meta?.microErr || meta?.userErr;
  if (err) {
    metaOut.code = err.code || err.name;
    metaOut.details = err.details || err.message || String(err);
    metaOut.hint = err.hint ?? undefined;
    metaOut.msg = err.message ?? undefined;
  }
  return NextResponse.json({ ok: false, error: { code, message }, meta: metaOut }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields early
    const required = ["name", "phone", "category", "slug"] as const;
    for (const k of required) {
      if (!body?.[k] || String(body[k]).trim() === "") {
        return j(400, "VALIDATION_FAILED", `Missing field: ${k}`);
      }
    }

    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) return j(401, "AUTH_USER_ERROR", "Unable to read session user.", { userErr });
    if (!user) return j(401, "UNAUTHENTICATED", "No active session. Please sign in again.");

    // Debug breadcrumbs (visible in Vercel logs, not returned to client)
    console.log("[publish] user", user.id);
    console.log("[publish] payload", {
      name: body.name,
      phone: body.phone,
      category: body.category,
      slug: body.slug,
    });

    // Check slug uniqueness
    const { data: existing, error: existErr } = await supabase
      .from("Providers")
      .select("id, slug")
      .eq("slug", body.slug)
      .limit(1)
      .maybeSingle();

    if (existErr) return j(500, "SLUG_CHECK_FAILED", "Failed checking slug.", { existErr });

    let finalSlug = body.slug;
    if (existing) finalSlug = `${body.slug}-${Math.random().toString(36).slice(2, 6)}`;

    // Upsert provider profile — RLS must permit owner inserts
    const providerPayload = {
      owner_id: user.id,
      name: body.name,
      phone: body.phone,
      category: body.category,
      slug: finalSlug,
      city: body.city ?? null,
      about: body.about ?? null,
      price_range: body.priceRange ?? null,
      verified: false,
      status: "active",
    };

    const { data: upserted, error: upsertErr } = await supabase
      .from("Providers")
      .upsert(providerPayload, { onConflict: "slug" })
      .select("id, slug, owner_id")
      .single();

    if (upsertErr) {
      // Most common root causes: RLS blocked insert, NOT NULL violation, bad column names
      return j(400, "UPSERT_FAILED", "Could not publish provider.", { upsertErr, providerPayload });
    }

    // Ensure Microsite row (if model exists)
    const { error: microErr } = await supabase
      .from("Microsites")
      .upsert(
        {
          owner_id: user.id,
          provider_id: upserted.id,
          slug: upserted.slug,
          is_live: true,
        },
        { onConflict: "provider_id" }
      );

    if (microErr) {
      return j(500, "MICROSITE_UPSERT_FAILED", "Microsite creation failed.", { microErr });
    }

    return NextResponse.json(
      {
        ok: true,
        provider_id: upserted.id,
        slug: upserted.slug,
        redirect: `/dashboard?slug=${upserted.slug}`,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return j(500, "UNHANDLED", "Unexpected server error.", { message: e?.message });
  }
}
