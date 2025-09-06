// app/api/contacts/verify/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ---------- utils ---------- */
function j(body: any, code = 200) {
  return NextResponse.json(body, {
    status: code,
    headers: { "Cache-Control": "no-store" },
  });
}

const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveProvider(slug: string) {
  try {
    const r = await fetch(
      `${ORIGIN}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => null);
    if (!j?.ok || !j?.id) return null;
    return j; // { ok, id, slug, display_name, profession, category }
  } catch {
    return null;
  }
}

async function logEvent(req: NextRequest, payload: any) {
  try {
    const r = await fetch(new URL("/api/events/log", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* ---------- GET: surface ambiguous contacts (safe heuristic) ---------- */
/**
 * Heuristic only (no schema drift):
 * - Look at recent Leads for this provider.
 * - Group by phone/email in app logic.
 * - Return groups with >1 occurrences as merge candidates.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) return j({ ok: false, error: "missing slug" }, 400);

  const provider = await resolveProvider(slug);
  if (!provider?.id) return j({ ok: false, error: "provider_not_found" }, 404);

  // Best-effort read from Leads; fail-open to empty.
  let rows: any[] = [];
  try {
    const { data } = await admin()
      .from("Leads")
      .select("id, provider_id, phone, email, patient_name, created_at")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false })
      .limit(500);
    rows = data || [];
  } catch {
    rows = [];
  }

  // Group by phone / email to find duplicates
  const byPhone: Record<string, any[]> = {};
  const byEmail: Record<string, any[]> = {};

  for (const r of rows) {
    const p = (r.phone || "").toString().replace(/[^\d+]/g, "");
    const e = (r.email || "").toString().trim().toLowerCase();
    if (p && p.length >= 8) (byPhone[p] ||= []).push(r);
    if (e && e.includes("@")) (byEmail[e] ||= []).push(r);
  }

  const items: any[] = [];

  for (const [k, arr] of Object.entries(byPhone)) {
    if (arr.length > 1) {
      items.push({
        key: `phone:${k}`,
        kind: "phone-dup",
        hint: k,
        leads: arr.map((r) => ({
          id: r.id,
          name: r.patient_name || null,
          phone: r.phone || null,
          email: r.email || null,
          created_at: r.created_at || null,
        })),
      });
    }
  }

  for (const [k, arr] of Object.entries(byEmail)) {
    if (arr.length > 1) {
      items.push({
        key: `email:${k}`,
        kind: "email-dup",
        hint: k,
        leads: arr.map((r) => ({
          id: r.id,
          name: r.patient_name || null,
          phone: r.phone || null,
          email: r.email || null,
          created_at: r.created_at || null,
        })),
      });
    }
  }

  return j({
    ok: true,
    slug,
    provider_id: provider.id,
    items, // can be []
    note:
      items.length === 0
        ? "No ambiguous contacts found (heuristic)."
        : "Ambiguous groups detected; POST to merge/reject.",
  });
}

/* ---------- POST: merge/reject (telemetry-first, fail-open DB) ---------- */
/**
 * Body: { action: "merge"|"reject", a_id: string, b_id: string }
 * - merge: treat b as duplicate of a (best-effort DB updates if columns exist)
 * - reject: record decision only (no DB change)
 * Always logs telemetry (strict schema).
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) return j({ ok: false, error: "missing slug" }, 400);

  const provider = await resolveProvider(slug);
  if (!provider?.id) return j({ ok: false, error: "provider_not_found" }, 404);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return j({ ok: false, error: "invalid_json" }, 400);
  }

  const action = (body?.action || "").toString().toLowerCase();
  const a_id = (body?.a_id || "").toString();
  const b_id = (body?.b_id || "").toString();

  if (!["merge", "reject"].includes(action))
    return j({ ok: false, error: "invalid_action" }, 400);
  if (!a_id || !b_id)
    return j({ ok: false, error: "missing_ids" }, 400);

  const now = Date.now();
  const eventName =
    action === "merge" ? "contact.merge.accepted" : "contact.merge.rejected";

  // Telemetry (strict schema)
  const logged = await logEvent(req, {
    event: eventName,
    ts: now,
    provider_id: provider.id,
    lead_id: null,
    source: {
      via: "contacts.verify",
      slug,
      a_id,
      b_id,
    },
  });

  // Best-effort DB adjustments (NO schema drift; ignore failures)
  if (action === "merge") {
    try {
      // If your schema has a "merged_into" or "is_duplicate" column, this will succeed.
      await admin().from("Leads").update({ merged_into: a_id }).eq("id", b_id);
      await admin().from("Leads").update({ is_duplicate: true }).eq("id", b_id);
    } catch {}
  }

  return j({
    ok: true,
    slug,
    provider_id: provider.id,
    action,
    a_id,
    b_id,
    telemetry_logged: !!logged,
  });
}
