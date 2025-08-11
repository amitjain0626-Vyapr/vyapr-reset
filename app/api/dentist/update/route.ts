// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({} as any));

  // NOTE: temporarily exclude google_maps_link to avoid schema cache errors
  const payload = {
    name: (body.name ?? "").slice(0, 120),
    phone: (body.phone ?? "").slice(0, 40),
    about: (body.about ?? "").slice(0, 4000),
    specialization: (body.specialization ?? "").slice(0, 200),
    address_line1: (body.address_line1 ?? "").slice(0, 200),
    address_line2: (body.address_line2 ?? "").slice(0, 200),
    city: (body.city ?? "").slice(0, 120),
    website: (body.website ?? "").slice(0, 300),
    // google_maps_link: (body.google_maps_link ?? "").slice(0, 500), // disabled for now
    profile_image_url: (body.profile_image_url ?? "").slice(0, 500),
    clinic_image_url: (body.clinic_image_url ?? "").slice(0, 500),
    services: (body.services ?? "").slice(0, 4000),
    is_published: !!body.is_published,
  };

  const wantedSlug = (body.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);

  const { data: existing, error: findErr } = await supabase
    .from("Dentists")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });
  }

  let slug = existing?.slug || wantedSlug || null;

  if (!existing?.slug && slug) {
    const { data: dup } = await supabase
      .from("Dentists")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (dup) slug = `${slug}-${user.id.slice(0, 6)}`;
  }

  const row = {
    ...payload,
    slug,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase.from("Dentists").update(row).eq("user_id", user.id).select("*").maybeSingle()
    : await supabase.from("Dentists").insert(row).select("*").maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
