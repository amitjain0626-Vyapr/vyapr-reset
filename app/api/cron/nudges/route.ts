// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient as createSb } from "@supabase/supabase-js";

// Nudge window: 12 hours
const WINDOW_MS = 12 * 60 * 60 * 1000;

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function run() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "server_misconfigured_supabase" }, 500);

  const admin = createSb(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) Published providers
  const { data: providers, error: pErr } = await admin
    .from("Providers")
    .select("id, slug, published")
    .eq("published", true);

  if (pErr) return json({ ok: false, error: "provider_query_failed", details: String(pErr.message || pErr) }, 500);

  const cutoffISO = new Date(Date.now() - WINDOW_MS).toISOString();

  let totalCandidates = 0;
  let totalInserted = 0;
  const perProvider: Record<string, { candidates: number; inserted: number; lastError?: string }> = {};

  for (const p of providers || []) {
    const slug = p.slug || "null";

    // 2) Find due leads (status=new older than window)
    const { data: leads, error: lErr } = await admin
      .from("Leads")
      .select("id, status, created_at")
      .eq("provider_id", p.id)
      .eq("status", "new")
      .lt("created_at", cutoffISO)
      .order("created_at", { ascending: false })
      .limit(500);

    if (lErr) {
      perProvider[slug] = { candidates: 0, inserted: 0, lastError: String(lErr.message || lErr) };
      continue;
    }

    const candidates = leads?.length || 0;
    totalCandidates += candidates;
    perProvider[slug] = { candidates, inserted: 0 };
    if (!candidates) continue;

    // 3) Insert into YOUR Events schema: event, ts, provider_id, lead_id, source
    const nowMs = Date.now();
    const rows = (leads || []).map((l) => ({
      event: "nudge.suggested",
      ts: nowMs,                 // bigint milliseconds
      provider_id: p.id,         // NOT NULL
      lead_id: l.id,             // nullable OK
      source: { reason: "new>=12h", cutoffISO }, // NOT NULL (json/text), we send object
    }));

    const r = await admin.from("Events").insert(rows).select("lead_id");
    if (r.error) {
      perProvider[slug].lastError = String(r.error.message || r.error);
    } else {
      const inserted = (r.data || []).length;
      perProvider[slug].inserted = inserted;
      totalInserted += inserted;
    }
  }

  return json({
    ok: true,
    windowHours: WINDOW_MS / 3600000,
    cutoffISO,
    providers: Object.keys(perProvider).length,
    totalCandidates,
    totalInserted,
    perProvider,
  });
}

// Accept BOTH GET and POST to avoid 405s
export async function GET() { return run(); }
export async function POST() { return run(); }
