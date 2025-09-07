// app/api/providers/resolve/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

let createAdminClient: any;
async function getAdmin() {
  if (createAdminClient) return createAdminClient;
  try {
    ({ createAdminClient } = await import("@/lib/supabase/admin"));
  } catch {
    ({ createAdminClient } = await import("@/lib/supabaseAdmin"));
  }
  return createAdminClient;
}

function ok(json: any, code = 200) {
  return NextResponse.json(json, { status: code });
}
function bad(msg: string, code = 400) {
  return ok({ ok: false, error: msg }, code);
}

/** Map raw categories to friendly, capitalized labels */
function normalizeProfession(raw?: string | null) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  const map: Record<string, string> = {
    dentist: "Dentist",
    dental: "Dentist",
    astro: "Astrologer",
    astrologer: "Astrologer",
    dance: "Dance Instructor",
    dancer: "Dance Instructor",
    physio: "Physiotherapist",
    physiotherapist: "Physiotherapist",
    tuition: "Tutor",
    tutor: "Tutor",
    salon: "Stylist",
    fitness: "Fitness Coach",
    yoga: "Yoga Instructor",
  };
  return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
  if (!slug) return bad("missing slug");

  const supa = (await getAdmin())();

  // SELECT ONLY existing columns (no "profession" column in Providers)
  const { data, error } = await supa
    .from("Providers")
    .select("id, slug, display_name, category, created_at")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return bad(error.message, 500);
  if (!data || data.length === 0) return bad("not found", 404);

  const row = data[0] as {
    id: string;
    slug?: string | null;
    display_name?: string | null;
    category?: string | null;
  };

  const resolvedSlug = (row.slug || slug).toString();
  const display_name =
    (row.display_name || resolvedSlug || "your service provider").toString();

  // Profession is derived from category
  const profession = normalizeProfession(row.category || null);

  return ok({
    ok: true,
    id: row.id,
    slug: resolvedSlug,
    display_name,
    profession,              // derived (e.g., "Dentist") or null
    category: row.category || null,
  });
}
