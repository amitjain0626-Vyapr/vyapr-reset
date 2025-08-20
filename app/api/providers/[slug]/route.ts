// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(_req: Request, ctx: { params?: { slug?: string } }) {
  try {
    const slug = ctx?.params?.slug;
    if (!slug) {
      return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    const admin = getAdmin();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 500 });
    }

    // Try explicit column list first (for safety). If that's too strict on your current schema,
    // we fall back to '*' so we don't 500 when some columns are missing.
    const explicit =
      "id,slug,name,category,url,bio,phone,whatsapp,location,address_line1,address_line2,pincode,latitude,longitude,price_range,opening_hours,faqs,created_at";

    let { data, error } = await admin
      .from("Providers")
      .select(explicit)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      // Fallback to '*' if some columns don't exist yet.
      const retry = await admin.from("Providers").select("*").eq("slug", slug).maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Fail-open: ensure fields exist (even if null) so the UI layer can read them safely.
    const provider = {
      id: data.id ?? null,
      slug: data.slug ?? null,
      name: data.name ?? null,
      category: data.category ?? null,
      url: data.url ?? null,
      bio: data.bio ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      location: data.location ?? null,
      address_line1: data.address_line1 ?? null,
      address_line2: data.address_line2 ?? null,
      pincode: data.pincode ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      price_range: data.price_range ?? null,
      opening_hours: data.opening_hours ?? null,
      faqs: data.faqs ?? null,
      created_at: data.created_at ?? null,
    };

    return NextResponse.json(
      { ok: true, provider },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
