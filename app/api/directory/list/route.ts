// app/api/directory/list/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // New: accept legacy combo like "dentist-delhi"
  const rawCat = (searchParams.get("cat") || "").trim();
  const rawLoc = (searchParams.get("loc") || "").trim();
  const combo  = (searchParams.get("combo") || "").trim();

  let catFilter = rawCat;
  let locFilter = rawLoc;
  if (combo) {
    // Split by hyphen; first = category, rest = location (joined with space)
    const parts = combo.split("-").filter(Boolean);
    if (parts.length >= 2) {
      catFilter = parts[0];
      locFilter = parts.slice(1).join(" ");
    } else {
      // If only one token, treat it as category
      catFilter = parts[0] || rawCat;
    }
  }

  const sb = admin();

  // 1) Base: filtered providers (published)
  const filtered = await sb
    .from("Providers")
    .select("id, slug, display_name, category, location, bio")
    .eq("published", true)
    .ilike("category", `%${catFilter}%`)
    .ilike("location", `%${locFilter}%`);

  const filteredProviders = filtered.data || [];

  // 2) Boost window: last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // 3) Find all boosted provider_ids (regardless of cat/loc filters)
  const boosts = await sb
    .from("Events")
    .select("provider_id, ts")
    .eq("event", "boost.enabled")
    .gte("ts", cutoff);

  const boostedIds = new Set<string>((boosts.data || []).map((b: any) => b.provider_id));

  // ---- VERIFIED FLAG (derive from Events; aligns with /api/verification/status) ----
  const VERIFIED_EVENTS = [
    "provider.verified",
    "verification.verified",
    "verification.approved",
    "verification.badge.granted",
    "trust.verified",
    "kyc.verified",
  ];

  const verifs = await sb
    .from("Events")
    .select("provider_id")
    .in("event", VERIFIED_EVENTS);

  const verifiedIds = new Set<string>((verifs.data || []).map((v: any) => v.provider_id));
  // -------------------------------------------------------------------------------

  // 4) Fetch details for boosted providers (published) that may be outside current filters
  let boostedProviders: any[] = [];
  if (boostedIds.size) {
    const allBoosted = await sb
      .from("Providers")
      .select("id, slug, display_name, category, location, bio")
      .eq("published", true)
      .in("id", Array.from(boostedIds));

    boostedProviders = allBoosted.data || [];
  }

  // 5) Merge: boosted (global) + filtered; mark boosted/verified flags; dedupe by id
  const map = new Map<string, any>();

  for (const p of boostedProviders) {
    map.set(p.id, { ...p, boosted: true, verified: verifiedIds.has(p.id) });
  }

  for (const p of filteredProviders) {
    const existing = map.get(p.id);
    const merged = existing ? { ...existing, ...p } : { ...p };

    merged.boosted = !!(merged.boosted || boostedIds.has(p.id));
    merged.verified = !!(merged.verified || verifiedIds.has(p.id));

    map.set(p.id, merged);
  }

  const enriched = Array.from(map.values());

  // 6) Sort: boosted-first, then by display_name (stable)
  enriched.sort((a, b) => {
    if (!!a.boosted !== !!b.boosted) return a.boosted ? -1 : 1;
    const an = (a.display_name || a.slug || "").toLowerCase();
    const bn = (b.display_name || b.slug || "").toLowerCase();
    return an.localeCompare(bn);
  });

  return NextResponse.json({ ok: true, providers: enriched });
}
