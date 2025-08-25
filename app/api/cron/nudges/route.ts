// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient as createSb } from "@supabase/supabase-js";

const WINDOW_MS = 12 * 60 * 60 * 1000; // 12h

function ok(json: any, code = 200) {
  return NextResponse.json(json, { status: code, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!SUPABASE_URL || !SERVICE_KEY) return ok({ ok: false, error: "server_misconfigured_supabase" }, 500);

    const admin = createSb(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // published providers
    const { data: providers, error: pErr } = await admin
      .from("Providers")
      .select("id, slug, published")
      .eq("published", true);

    if (pErr) return ok({ ok: false, error: "provider_query_failed", details: String(pErr.message || pErr) }, 500);

    const cutoffISO = new Date(Date.now() - WINDOW_MS).toISOString();

    let totalCandidates = 0;
    let totalInserted = 0;
    const perProvider: Record<string, { candidates: number; inserted: number }> = {};

    for (const p of providers || []) {
      const { data: leads, error: lErr } = await admin
        .from("Leads")
        .select("id, status, created_at")
        .eq("provider_id", p.id)
        .eq("status", "new")
        .lt("created_at", cutoffISO)
        .order("created_at", { ascending: false })
        .limit(500);

      if (lErr) continue;

      const candidates = leads?.length || 0;
      totalCandidates += candidates;
      perProvider[p.slug || "null"] = { candidates, inserted: 0 };
      if (!candidates) continue;

      const nowISO = new Date().toISOString();
      const rowsRich = (leads || []).map((l) => ({
        type: "nudge.suggested",
        name: "nudge.suggested",
        provider_id: p.id,
        lead_id: l.id,
        meta: { reason: "new>=12h", cutoffISO },
        payload: { reason: "new>=12h", cutoffISO },
        created_at: nowISO,
      }));

      let inserted = 0;

      // Try rich
      const r1 = await admin.from("Events").insert(rowsRich).select("lead_id");
      if (!r1.error) {
        inserted = (r1.data || []).length;
      } else {
        // Try minimal (common cols)
        const rowsMin = rowsRich.map((r) => ({
          name: "nudge.suggested",
          provider_id: r.provider_id,
          lead_id: r.lead_id,
          created_at: r.created_at,
        })) as any[];

        const r2 = await admin.from("Events").insert(rowsMin).select("lead_id");
        if (!r2.error) {
          inserted = (r2.data || []).length;
        } else {
          // Final fallback: name only (works even if table only has 'name')
          const rowsNameOnly = rowsRich.map(() => ({ name: "nudge.suggested" })) as any[];
          const r3 = await admin.from("Events").insert(rowsNameOnly).select("name");
          if (!r3.error) inserted = (r3.data || []).length;
        }
      }

      totalInserted += inserted;
      perProvider[p.slug || "null"].inserted = inserted;
    }

    return ok({
      ok: true,
      windowHours: WINDOW_MS / 3600000,
      cutoffISO,
      providers: Object.keys(perProvider).length,
      totalCandidates,
      totalInserted,
      perProvider,
    });
  } catch (e: any) {
    return ok({ ok: false, error: String(e?.message || e) }, 500);
  }
}
