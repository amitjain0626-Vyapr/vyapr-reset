// app/api/dentist/update/route.ts
// @ts-nocheck

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ---- Supabase server client (Route Handler-safe cookie I/O)
function getSupabaseServer() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
  return supabase;
}

// ---- Only allow updates to these columns
const ALLOWED_FIELDS = new Set([
  "name",
  "phone",
  "email",
  "city",
  "address",
  "about",
  "services",
  "experience_years",
  "clinic_name",
  "clinic_address",
  "profile_image_url",
  "clinic_image_url",
  "razorpay_payment_link",
  "ondc_store_link",
  "website_url",
  "whatsapp_number",
  "google_maps_link", // <-- now supported end-to-end
  "is_published",
  "slug",
]);

type Body = Record<string, any>;

// Normalize slug (lowercase, trim, hyphenate)
function normalizeSlug(input: string) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    // ---- AuthN
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ---- Parse body & whitelist fields
    const raw: Body = await req.json().catch(() => ({}));
    const payload: Body = {};
    for (const [k, v] of Object.entries(raw)) {
      if (ALLOWED_FIELDS.has(k)) payload[k] = v;
    }

    // ---- Basic field hygiene
    if (typeof payload.slug === "string") {
      payload.slug = normalizeSlug(payload.slug);
    }
    if (payload.google_maps_link && typeof payload.google_maps_link !== "string") {
      payload.google_maps_link = String(payload.google_maps_link);
    }

    // ---- Fetch existing dentist row for this user
    const { data: existing, error: fetchErr } = await supabase
      .from("Dentists")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch dentist", details: fetchErr.message },
        { status: 500 }
      );
    }

    // ---- On publish, enforce slug presence + uniqueness
    const wantsPublish = payload.is_published === true || payload.is_published === "true";
    if (wantsPublish) {
      if (!payload.slug && !existing?.slug) {
        return NextResponse.json(
          { ok: false, error: "Slug required to publish" },
          { status: 400 }
        );
      }
      const effectiveSlug = payload.slug || existing?.slug;
      // Check if some other row already uses this slug
      const { data: slugHit, error: slugErr } = await supabase
        .from("Dentists")
        .select("id, user_id, slug")
        .eq("slug", effectiveSlug)
        .maybeSingle();

      if (slugErr) {
        return NextResponse.json(
          { ok: false, error: "Slug check failed", details: slugErr.message },
          { status: 500 }
        );
      }
      if (slugHit && slugHit.user_id !== user.id) {
        return NextResponse.json(
          { ok: false, error: "Slug already in use", slug: effectiveSlug },
          { status: 409 }
        );
      }
      // Ensure is_published true if requested
      payload.is_published = true;
      // Optional: set a published timestamp if your schema has it
      // payload.published = new Date().toISOString();
    }

    // ---- Prepare upsert/update object
    const now = new Date().toISOString();
    const updateObj: Body = {
      ...payload,
      updated_at: now,
    };

    let result;

    if (existing?.id) {
      // UPDATE existing row
      const { data, error } = await supabase
        .from("Dentists")
        .update(updateObj)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { ok: false, error: "Update failed", details: error.message },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // INSERT new row for this user
      const insertObj = {
        user_id: user.id,
        ...updateObj,
        created_at: now,
      };
      const { data, error } = await supabase
        .from("Dentists")
        .insert(insertObj)
        .select("*")
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { ok: false, error: "Insert failed", details: error.message },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
