// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// Force Node.js runtime to avoid Edge cookie issues
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = {
  name: string;
  phone: string;
  category: string;
  slug: string;
  city?: string;
  about?: string;
  priceRange?: string;
};

function jsonError(status: number, code: string, message: string, meta: any = {}) {
  return NextResponse.json(
    { ok: false, error: { code, message, meta } },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    // Parse body early and validate
    const body = (await req.json()) as PublishBody;
    const required = ["name", "phone", "category", "slug"] as const;
    for (const k of required) {
      if (!body?.[k]) return jsonError(400, "VALIDATION_FAILED", `Missing field: ${k}`);
    }

    // Create server-side client bound to request cookies
    const supabase = createRouteHandlerClient({ cookies });

    // Confirm we HAVE a user session in this API route
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      return jsonError(401, "AUTH_USER_ERROR", "Unable to read session user.", { userErr });
    }
    if (!user) {
      return jsonError(401, "UNAUTHENTICATED", "No active session. Please sign in again.");
    }

    // Ensure slug is unique (append suffix if taken)
    const { data: existing, error: existErr } = await supabase
      .from("Providers")
      .select("id, slug")
      .eq("slug", body.slug)
      .limit(1)
      .maybeSingle();

    if (existErr) {
      return jsonError(500, "SLUG_CHECK_FAILED", "Failed checking slug.", { existErr });
    }

    let finalSlug = body.slug;
    if (existing) {
      finalSlug = `${body.slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Upsert provider profile (RLS expects owner_id = auth.uid())
    const payload = {
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
      .upsert(payload)
      .select("id, slug")
      .single();

    if (upsertErr) {
      return jsonError(400, "UPSERT_FAILED", "Could not publish provider.", { upsertErr });
    }

    // Also ensure Microsite row (if your schema needs it)
    const { error: microErr } = await supabase
      .from("Microsites")
      .upsert({
        owner_id: user.id,
        provider_id: upserted.id,
        slug: upserted.slug,
        is_live: true,
      });

    if (microErr) {
      return jsonError(500, "MICROSITE_UPSERT_FAILED", "Microsite creation failed.", { microErr });
    }

    return NextResponse.json(
      { ok: true, provider_id: upserted.id, slug: upserted.slug, redirect: `/dashboard?slug=${upserted.slug}` },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonError(500, "UNHANDLED", "Unexpected server error.", { message: e?.message });
  }
}
