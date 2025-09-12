// app/api/contacts/verify/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
/* === INSERT (22.22): TG cohort dictionary for +10 boost (already present) === */
import { TG_TERMS } from "@/lib/copy/tg";
/* === INSERT END === */

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

/* === INSERT (22.23): keyword helpers (no schema drift) === */
function normLower(s: any): string {
  return (s ?? "").toString().toLowerCase();
}

/** Return the first matching TG keyword for this lead, or null. */
function findKeywordHit(
  lead: { patient_name?: string | null; email?: string | null },
  providerCategory?: string | null
): string | null {
  try {
    const cat = normLower(providerCategory).trim();
    const terms: string[] = (TG_TERMS as any)?.[cat] || [];
    if (!terms?.length) return null;

    // Combine simple text fields we have on LeadLite
    const hay = `${normLower(lead.patient_name)} ${normLower(lead.email)}`;
    if (!hay.trim()) return null;

    for (const t of terms) {
      const term = normLower(t).trim();
      if (!term) continue;
      // simple contains match (no regex), safe for user input
      if (hay.includes(term)) return t;
    }
    return null;
  } catch {
    return null;
  }
}
/* === INSERT END (22.23) === */

/* === KOREKKO: Contact scoring START (22.17 + TG boost 22.22) === */
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

/* NOTE: providerCategory param enables TG +10 */
function scoreLead(
  lead: LeadLite,
  eventsByLead: Map<string, EventLite[]>,
  providerCategory?: string | null
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

  // TG cohort boost (+10) when provider.category recognized
  try {
    const cat = String(providerCategory || "").toLowerCase().trim();
    if (cat && TG_TERMS && Object.prototype.hasOwnProperty.call(TG_TERMS, cat)) {
      score += 10;
      reasons.push("tg_boost_applied");
    }
  } catch {
    // ignore
  }

    /* === INSERT (22.23): contextual keyword boost (+10) with reason kw:<term> === */
  const kwHit = findKeywordHit(lead, providerCategory);
  if (kwHit) {
    score += 10;
    reasons.push(`kw:${kwHit}`);
  }
  /* === INSERT END (22.23) === */

  if (score > 100) score = 100;
  const t = tierFor(score);
  return { score, tier: t, reasons };
}
/* === KOREKKO: Contact scoring END === */

/* ---------- GET ---------- */
/**
 * Modes (no schema drift for default):
 * - default (no mode): return duplicate groups (existing behavior)
 * - mode=flat: return a flat list of scored leads (limit N)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  const mode = (url.searchParams.get("mode") || "").toLowerCase();
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50)
  );

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

  /* === INSERT: mode=flat branch (new) === */
  if (mode === "flat") {
    const scored = rows.map((r) => {
      const s = scoreLead(r, eventsByLead, provider?.category || null);
      return {
        id: r.id,
        name: r.patient_name || null,
        phone: r.phone || null,
        email: r.email || null,
        created_at: r.created_at || null,
        score: s.score,
        tier: s.tier,
        reasons: s.reasons,
      };
    });

    // Sort by score desc, then recency desc; then limit
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = toMs(a.created_at) || 0, tb = toMs(b.created_at) || 0;
      return tb - ta;
    });

    return j({
      ok: true,
      slug,
      provider_id: provider.id,
      mode: "flat",
      limit,
      items: scored.slice(0, limit),
      note: "Flat scored list (no schema drift to default mode).",
    });
  }
  /* === INSERT END === */

  // ===== existing behavior (duplicate groups) =====
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
          const scored = scoreLead(r, eventsByLead, provider?.category || null);
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
          const scored = scoreLead(r, eventsByLead, provider?.category || null);
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

/* === INSERT (22.23): Auto-merge exact phone dupes === */
// Helper: normalize phone to digits with basic India-like handling (no schema drift)
function normPhone(p?: string | null): string {
  if (!p) return "";
  const digits = p.toString().replace(/[^\d]/g, "");
  // Normalize common India patterns: 0XXXXXXXXX, 91XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

async function fetchLeadsForProvider(provider_id: string) {
  try {
    const { data } = await admin()
      .from("Leads")
      .select("id, provider_id, phone, email, patient_name, created_at")
      .eq("provider_id", provider_id)
      .order("created_at", { ascending: false })
      .limit(1000);
    return data || [];
  } catch {
    return [];
  }
}

async function fetchEventsByLead(provider_id: string) {
  const map = new Map<string, EventLite[]>();
  try {
    const since = Date.now() - 18 * 30 * 24 * 60 * 60 * 1000; // ~18 months
    const { data: evts } = await admin()
      .from("Events")
      .select("event, ts, lead_id")
      .eq("provider_id", provider_id)
      .gte("ts", since)
      .limit(5000);
    (evts || []).forEach((e: any) => {
      const lid = e?.lead_id || null;
      if (!lid) return;
      const arr = map.get(lid) || [];
      arr.push({ event: e.event, ts: e.ts, lead_id: lid });
      map.set(lid, arr);
    });
  } catch {}
  return map;
}
/* === INSERT END (22.23 helpers) === */

/* ---------- POST: merge/reject (unchanged) ---------- */
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
    /* === INSERT (22.23): action=automerge_exact_phone === */
  if (action === "automerge_exact_phone") {
    const now = Date.now();

    // 1) Load leads + recent events for scoring
    const rows = await fetchLeadsForProvider(provider.id);
    const eventsByLead = await fetchEventsByLead(provider.id);

    // 2) Group by normalized phone
    const groups: Record<string, any[]> = {};
    for (const r of rows) {
      const key = normPhone(r.phone || "");
      if (key && key.length >= 10) (groups[key] ||= []).push(r);
    }

    // 3) For each group with >1, pick keeper by (score desc → created_at desc)
    const merges: Array<{ keeper: string; child: string; key: string }> = [];

    for (const [key, arr] of Object.entries(groups)) {
      if (!arr || arr.length <= 1) continue;

      // Score each
      const scored = arr.map((r) => {
        const s = scoreLead(r, eventsByLead, provider?.category || null);
        return { row: r, score: s.score, createdMs: toMs(r.created_at || null) || 0 };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.createdMs - a.createdMs;
      });

      const keeper = scored[0].row;
      const children = scored.slice(1).map((x) => x.row);

      // 4) Persist duplicate flag + merged_into for children (best-effort) and log telemetry
      for (const child of children) {
        try {
          await admin().from("Leads").update({ merged_into: keeper.id }).eq("id", child.id);
          await admin().from("Leads").update({ is_duplicate: true }).eq("id", child.id);
        } catch {}

        await logEvent(req, {
          event: "contact.merge.auto",
          ts: now,
          provider_id: provider.id,
          lead_id: child.id,
          source: {
            via: "contacts.verify",
            slug,
            key: `phone:${key}`,
            keeper_id: keeper.id,
          },
        });

        merges.push({ keeper: keeper.id, child: child.id, key: `phone:${key}` });
      }
    }

    return j({
      ok: true,
      slug,
      provider_id: provider.id,
      action,
      mergedCount: merges.length,
      merges,
      note: "Auto-merged exact phone duplicates; one telemetry event per child.",
    });
  }
  /* === INSERT END (22.23) === */

  if (!["merge", "reject"].includes(action))
    return j({ ok: false, error: "invalid_action" }, 400);
  if (!a_id || !b_id)
    return j({ ok: false, error: "missing_ids" }, 400);

  const now = Date.now();
  const eventName =
    action === "merge" ? "contact.merge.accepted" : "contact.merge.rejected";

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

  if (action === "merge") {
    try {
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
