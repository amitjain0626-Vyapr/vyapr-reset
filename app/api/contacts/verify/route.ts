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

// Use live host as safe default (can be overridden by NEXT_PUBLIC_BASE_URL)
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

/* === KOREKKO: Contact scoring START (22.17) ===
   v1 (metadata-only) Engagement Score, tiering & reasons.
   - No schema drift. All app-side logic.
   - Signals:
     • Recency by created_at (<=180d, <=365d)
     • Identity quality: phone (India-like), email present
     • Cross-channel: Events presence for this lead_id
       booking.* / payment.* (strong), lead.imported (weak)
   - Tiers:
     • score >= 80 → "auto"
     • 60..79     → "review"
     • < 60       → "low"
*/
type LeadLite = {
  id: string;
  provider_id: string;
  phone: string | null;
  email: string | null;
  patient_name?: string | null;
  created_at?: string | null;
};

type EventLite = { event: string; ts: number; lead_id: string | null };

function toMs(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

function isIndiaLikePhone(p?: string | null): boolean {
  if (!p) return false;
  const digits = p.replace(/[^\d]/g, "");
  // accept 10-digit, 11 with 0, 12 with 91
  return (
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith("0")) ||
    (digits.length === 12 && digits.startsWith("91"))
  );
}

function tierFor(score: number): "auto" | "review" | "low" {
  if (score >= 80) return "auto";
  if (score >= 60) return "review";
  return "low";
}

function scoreLead(
  lead: LeadLite,
  eventsByLead: Map<string, EventLite[]>
): { score: number; tier: string; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Identity quality
  if (isIndiaLikePhone(lead.phone)) {
    score += 20;
    reasons.push("valid_phone_india_like");
  }
  if (lead.email && lead.email.includes("@")) {
    score += 10;
    reasons.push("has_email");
  }

  // Recency by created_at
  const createdMs = toMs(lead.created_at || null);
  if (createdMs) {
    const now = Date.now();
    const days = (now - createdMs) / (1000 * 60 * 60 * 24);
    if (days <= 180) {
      score += 20;
      reasons.push("recent_record_<=180d");
    } else if (days <= 365) {
      score += 10;
      reasons.push("recent_record_<=365d");
    }
  }

  // Cross-channel Events
  const evts = eventsByLead.get(lead.id) || [];
  const hasStrong = evts.some((e) => /^payment\.|^booking\./.test(e.event));
  const hasImported = evts.some((e) => e.event === "lead.imported");

  if (hasStrong) {
    score += 40;
    reasons.push("events_payment_or_booking_present");
  } else if (hasImported) {
    score += 10;
    reasons.push("event_lead_imported_present");
  }

  // Clamp & tier
  if (score > 100) score = 100;
  const t = tierFor(score);
  return { score, tier: t, reasons };
}
/* === KOREKKO: Contact scoring END (22.17) === */

/* ---------- GET: surface ambiguous contacts (safe heuristic) ---------- */
/**
 * Heuristic only (no schema drift):
 * - Look at recent Leads for this provider.
 * - Group by phone/email in app logic.
 * - Return groups with >1 occurrences as merge candidates.
 * - ENRICH: each lead now includes {score, tier, reasons[]} (metadata-only).
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

  // Pull recent Events for cross-channel scoring (metadata-only)
  const eventsByLead = new Map<string, EventLite[]>();
  try {
    const since = Date.now() - 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months
    const { data: evts } = await admin()
      .from("Events")
      .select("event, ts, lead_id")
      .eq("provider_id", provider.id)
      .gte("ts", since)
      .limit(5000);
    (evts || []).forEach((e: any) => {
      const lid = e?.lead_id || null;
      if (!lid) return;
      const arr = eventsByLead.get(lid) || [];
      arr.push({ event: e.event, ts: e.ts, lead_id: lid });
      eventsByLead.set(lid, arr);
    });
  } catch {
    // ignore
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
        leads: arr.map((r) => {
          const scored = scoreLead(r, eventsByLead);
          return {
            id: r.id,
            name: r.patient_name || null,
            phone: r.phone || null,
            email: r.email || null,
            created_at: r.created_at || null,
            score: scored.score,
            tier: scored.tier,
            reasons: scored.reasons,
          };
        }),
      });
    }
  }

  for (const [k, arr] of Object.entries(byEmail)) {
    if (arr.length > 1) {
      items.push({
        key: `email:${k}`,
        kind: "email-dup",
        hint: k,
        leads: arr.map((r) => {
          const scored = scoreLead(r, eventsByLead);
          return {
            id: r.id,
            name: r.patient_name || null,
            phone: r.phone || null,
            email: r.email || null,
            created_at: r.created_at || null,
            score: scored.score,
            tier: scored.tier,
            reasons: scored.reasons,
          };
        }),
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
