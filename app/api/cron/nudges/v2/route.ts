// @ts-nocheck
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestNudgeConfig, isQuietHourIST } from "@/lib/nudges/config";

/**
 * Manual/cron-safe endpoint that respects latest nudge config.
 * GET /api/cron/nudges/v2?slug=<providerSlug>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")!;
  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

  const admin = createAdminClient();
  const { providerId, config } = await getLatestNudgeConfig(slug);

  if (!providerId) return NextResponse.json({ ok: false, error: "unknown slug" }, { status: 404 });

  // Respect quiet hours (IST)
  if (isQuietHourIST(new Date(), config.quiet_start, config.quiet_end)) {
    return NextResponse.json({
      ok: true,
      provider_slug: slug,
      skipped: "quiet_hours",
      config,
      suggested: 0
    });
  }

  // Find eligible leads (status=new older than 12h)
  const { data: leads } = await admin.rpc("eligible_nudge_leads_by_provider", {
    p_provider_id: providerId,
    p_older_than_hours: 12
  });

  const pool = Array.isArray(leads) ? leads.slice(0, Math.max(0, config.cap)) : [];

  // Log suggestions
  const ts = Date.now();
  if (pool.length) {
    const rows = pool.map((l: any) => ({
      event: "nudge.suggested",
      ts,
      provider_id: providerId,
      lead_id: l.id,
      source: { via: "cron.v2", reason: "status:new,>12h", cap: config.cap }
    }));
    await admin.from("Events").insert(rows);
  }

  return NextResponse.json({
    ok: true,
    provider_slug: slug,
    config,
    eligible: leads?.length ?? 0,
    suggested: pool.length
  });
}
