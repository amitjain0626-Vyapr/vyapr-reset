// app/api/leads/create/route.ts
// Runtime: Node.js (service role needed). No Edge runtime here.
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: "Missing SUPABASE env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" } as const;
  }
  return {
    client: createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "vyapr/api/leads/create" } },
    }),
  } as const;
}

/** Normalize Indian mobile numbers to E.164 if user typed 10 digits */
function normalizePhone(raw: string) {
  const s = (raw || "").trim();
  if (/^\+?\d{7,15}$/.test(s)) {
    if (/^\d{10}$/.test(s)) return `+91${s}`;
    if (/^\+/.test(s)) return s;
    return `+${s}`;
  }
  return s;
}

async function fetchMicrositeBySlug(supabase: any, slug: string) {
  // Try "Microsites" (quoted/mixed-case) then "microsites" (lower) — some prior tables were created mixed-case.
  const tryNames = ["Microsites", "microsites"];
  for (const table of tryNames) {
    const { data, error } = await supabase.from(table).select("*").eq("slug", slug).maybeSingle();
    if (!error && data) return { data, table };
    // If table not found (42P01), try next name; otherwise continue to next attempt.
  }
  return { data: null, error: `Microsite not found for slug: ${slug}` };
}

async function insertLead(supabase: any, payload: Record<string, any>) {
  // Try "Leads" then "leads" to match whichever exists
  const tables = ["Leads", "leads"];
  let lastError: any = null;
  for (const t of tables) {
    const { data, error } = await supabase.from(t).insert(payload).select().maybeSingle();
    if (!error && data) return { data, table: t };
    lastError = error;
  }
  return { data: null, error: lastError || "Insert failed" };
}

export async function POST(req: Request) {
  try {
    const { client: supabase, error: clientErr } = getSupabaseServiceClient();
    if (clientErr) {
      return NextResponse.json({ ok: false, error: clientErr }, { status: 500 });
    }

    const json = await req.json().catch(() => ({}));
    // Honeypot (basic bot filter)
    if (typeof json.website === "string" && json.website.trim().length > 0) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 204 });
    }

    const slug = String(json.slug || "").trim();
    const patient_name = String(json.patient_name || "").trim();
    const phone = normalizePhone(String(json.phone || "").trim());
    const note = typeof json.note === "string" ? json.note.slice(0, 2000) : "";
    const utm = typeof json.utm === "object" && json.utm !== null ? json.utm : {};

    if (!slug) {
      return NextResponse.json({ ok: false, error: "slug is required" }, { status: 400 });
    }
    if (!patient_name) {
      return NextResponse.json({ ok: false, error: "patient_name is required" }, { status: 400 });
    }
    if (!phone || !/^\+?\d{7,15}$/.test(phone)) {
      return NextResponse.json({ ok: false, error: "phone must be a valid number" }, { status: 400 });
    }

    // Resolve owner_id from the Microsite by slug
    const { data: site, error: siteErr } = await fetchMicrositeBySlug(supabase, slug);
    if (siteErr || !site) {
      return NextResponse.json({ ok: false, error: siteErr || "Microsite not found" }, { status: 404 });
    }

    // Handle possible column naming variants: owner_id / provider_id / user_id
    const owner_id =
      site.owner_id ?? site.provider_id ?? site.user_id ?? null;

    if (!owner_id) {
      return NextResponse.json({ ok: false, error: "Microsite owner not linked (owner_id missing)" }, { status: 422 });
    }

    const payload = {
      owner_id,   // <-- required by your DB (fixes prior NULL violation)
      slug,
      patient_name,
      phone,
      note,
      utm,        // JSONB in DB (as used in your earlier cURL)
      source: "microsite",
      status: "new",
    };

    const { data: inserted, error: insErr, table } = await insertLead(supabase, payload);
    if (insErr || !inserted) {
      return NextResponse.json({ ok: false, error: "Insert failed", details: insErr?.message || String(insErr) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead: inserted, table }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Unhandled error", details: e?.message || String(e) }, { status: 500 });
  }
}
