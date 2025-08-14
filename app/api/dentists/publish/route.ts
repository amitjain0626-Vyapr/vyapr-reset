// app/api/dentists/publish/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Minimal, local slugify to avoid path issues
function slugify(input: string) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function normalizePhone(p?: string) {
  if (!p) return "";
  const digits = p.replace(/\D+/g, "");
  // Keep last 10 as base (India) and prefix with +91 if not present
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return "+91" + last10;
  }
  return "+" + digits;
}

async function getSupabase() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // @ts-ignore
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });
}

export async function POST(req: Request) {
  const supabase = await getSupabase();

  // 1) Require auth
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Read payload
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const phoneRaw = String(body.phone || "").trim();
  const category = String(body.category || "").trim();
  const about = String(body.about || "");
  const address_line1 = String(body.address_line1 || "");
  const address_line2 = String(body.address_line2 || "");
  const website = String(body.website || "");
  const city = String(body.city || "");
  const services = body.services ?? "";
  const published = Boolean(body.published ?? true);
  const photo_url = String(body.photo_url || "");
  const cover_url = String(body.cover_url || "");
  const gmaps = String(body.gmaps || "");

  if (!name || !phoneRaw) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", details: "name and phone required" },
      { status: 400 }
    );
  }

  const phone = normalizePhone(phoneRaw);
  let baseSlug = slugify(body.slug || name);
  if (!baseSlug) baseSlug = "provider";

  // 3) Find existing profile for this owner
  const { data: existing, error: exErr } = await supabase
    .from("Providers")
    .select("id, slug, phone")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  // 4) Resolve a unique slug (if new OR owner wants to change slug)
  async function ensureUniqueSlug(desired: string, currentId?: string) {
    let candidate = desired;
    let suffix = 1;
    // check if slug used by someone else
    // if used by *same* row (currentId), allow it
    // otherwise keep incrementing -2, -3, …
    // NOTE: keep loop bounded (rare) to avoid edge-case
    for (let i = 0; i < 25; i++) {
      const { data } = await supabase
        .from("Providers")
        .select("id")
        .eq("slug", candidate)
        .limit(1)
        .maybeSingle();

      if (!data || (currentId && data.id === currentId)) {
        return candidate;
      }
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
    return `${desired}-${Date.now()}`; // ultimate fallback
  }

  let finalSlug = existing?.slug
    ? await ensureUniqueSlug(baseSlug, existing.id) // allow rename safely
    : await ensureUniqueSlug(baseSlug);

  // 5) If phone belongs to someone else, don’t block — we’ll keep normalized phone for this owner
  // Try to detect hard conflict: same phone, different owner.
  const { data: phoneOwner } = await supabase
    .from("Providers")
    .select("id, owner_id")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (phoneOwner && phoneOwner.owner_id !== user.id) {
    // Soft-resolve by not changing phone; store as alt_phone to avoid unique violation (if you have the column)
    // If your schema enforces unique phone, we’ll suffix slug and proceed with different phone formatting.
    // For now, we simply proceed — RLS/unique constraint will decide.
  }

  // 6) Upsert by owner_id (idempotent)
  const row = {
    owner_id: user.id,
    name,
    phone,
    category,
    about,
    address_line1,
    address_line2,
    website,
    city,
    services,
    published,
    photo_url,
    cover_url,
    gmaps,
    slug: finalSlug,
    updated_at: new Date().toISOString(),
  };

  // Insert or update the single row per owner
  // If you have a unique constraint on (owner_id), this will update the same row.
  const { data: upserted, error: upErr } = await supabase
    .from("Providers")
    .upsert(row, { onConflict: "owner_id" })
    .select("id, slug")
    .single();

  if (upErr) {
    // Return a friendly message like you saw on the UI
    return NextResponse.json(
      { ok: false, error: "publish_failed", details: upErr.message },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      slug: upserted?.slug || finalSlug,
      next: `/dashboard?slug=${encodeURIComponent(upserted?.slug || finalSlug)}`,
    },
    { status: 200 }
  );
}

export function GET() {
  return NextResponse.json({ ok: true, info: "POST to publish or update provider profile" });
}
