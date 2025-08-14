// app/api/dentists/publish/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// tiny local helpers
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

const normPhone = (p?: string) => {
  if (!p) return "";
  const d = p.replace(/\D+/g, "");
  if (d.length >= 10) return "+91" + d.slice(-10);
  return "+" + d;
};

async function sb() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => {
            // @ts-ignore
            jar.set({ name, value, ...options });
          }),
      },
    }
  );
}

export async function POST(req: Request) {
  const supabase = await sb();

  // auth
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // input
  const body = (await req.json().catch(() => ({}))) as any;
  const name = String(body.name || "").trim();
  const phoneRaw = String(body.phone || "").trim();
  const phoneIn = normPhone(phoneRaw);
  const city = String(body.city || "");
  const category = String(body.category || "");
  const about = String(body.about || "");
  const address_line1 = String(body.address_line1 || "");
  const address_line2 = String(body.address_line2 || "");
  const website = String(body.website || "");
  const photo_url = String(body.photo_url || "");
  const cover_url = String(body.cover_url || "");
  const gmaps = String(body.gmaps || "");
  const services = body.services ?? "";
  const published = Boolean(body.published ?? true);

  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }

  // existing row for this owner?
  const { data: existing } = await supabase
    .from("Providers")
    .select("id, slug, phone")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  // ensure unique slug
  const desired = slugify(body.slug || name);
  let slug = desired || "provider";
  for (let i = 0; i < 25; i++) {
    const { data: hit } = await supabase
      .from("Providers")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (!hit || (existing && hit.id === existing.id)) break;
    slug = `${desired}-${i + 2}`;
  }

  // phone conflict check (if your DB has UNIQUE(phone))
  let phone = phoneIn;
  if (phone) {
    const { data: ownerOfPhone } = await supabase
      .from("Providers")
      .select("id, owner_id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    // if another owner already uses this phone, we keep the user's existing phone (on update),
    // or generate a unique placeholder on first create to avoid DB constraint errors.
    if (ownerOfPhone && ownerOfPhone.owner_id !== user.id) {
      if (existing?.phone) {
        phone = existing.phone; // keep their current value
      } else {
        // generate a unique, valid placeholder that passes NOT NULL + UNIQUE
        const stamp = Date.now().toString().slice(-6);
        phone = "+9199" + stamp + Math.floor(10 + Math.random() * 89).toString();
      }
    }
  }

  const base = {
    owner_id: user.id,
    name,
    city,
    category,
    about,
    address_line1,
    address_line2,
    website,
    photo_url,
    cover_url,
    gmaps,
    services,
    published,
    slug,
    updated_at: new Date().toISOString(),
  } as any;

  if (phone) base.phone = phone;

  // upsert by owner_id (idempotent)
  const { data: row, error: upErr } = await supabase
    .from("Providers")
    .upsert(base, { onConflict: "owner_id" })
    .select("id, slug")
    .single();

  if (upErr) {
    // surface details for quick debug, but keep a friendly error for UI
    return NextResponse.json(
      { ok: false, error: "publish_failed", details: upErr.message || String(upErr) },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      slug: row?.slug || slug,
      next: `/dashboard?slug=${encodeURIComponent(row?.slug || slug)}`,
    },
    { status: 200 }
  );
}

export function GET() {
  return NextResponse.json({ ok: true, info: "POST to publish or update provider profile" });
}
