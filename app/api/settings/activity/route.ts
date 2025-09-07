// @ts-nocheck
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/settings/activity?slug=<providerSlug>&limit=25
 * Returns recent settings-related Events (upi.updated, nudge.config.updated, settings.*)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")!;
  const limit = Number(searchParams.get("limit") ?? 25);

  if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

  const admin = createAdminClient();

  const { data: provider } = await admin
    .from("Providers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!provider) return NextResponse.json({ ok: false, error: "unknown slug" }, { status: 404 });

  const { data: rows } = await admin
    .from("Events")
    .select("event, ts, lead_id, source")
    .eq("provider_id", provider.id)
    .in("event", ["upi.updated", "nudge.config.updated", "settings.updated"])
    .order("ts", { ascending: false })
    .limit(limit);

  return NextResponse.json({ ok: true, count: rows?.length ?? 0, rows: rows ?? [] });
}
