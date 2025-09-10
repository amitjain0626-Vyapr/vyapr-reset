// app/api/campaigns/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Service-role admin (no schema drift) */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolve provider_id by slug */
async function resolveProviderIdBySlug(slug: string) {
  const { data, error } = await admin()
    .from("Providers")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

/** Collapse last-known campaign states from Events (no schema drift) */
async function listExistingCampaigns(provider_id: string) {
  const { data, error } = await admin()
    .from("Events")
    .select("event, ts, source")
    .eq("provider_id", provider_id)
    .in("event", [
      "campaign.created",
      "campaign.updated",
      "campaign.paused",
      "campaign.resumed",
      "campaign.archived",
    ])
    .order("ts", { ascending: false })
    .limit(2000);

  if (error) return [];

  const byId = new Map<
    string,
    { id: string; label?: string; channel?: string; kind?: string; status?: string; updated_at?: number }
  >();

  for (const r of data || []) {
    const src: any = r?.source || {};
    const id = (src.id || src.campaign_id || "").toString().trim();
    if (!id) continue;
    if (byId.has(id)) continue; // first hit is most recent (desc)

    const status =
      r.event === "campaign.archived"
        ? "archived"
        : r.event === "campaign.paused"
        ? "paused"
        : r.event === "campaign.resumed" || r.event === "campaign.created" || r.event === "campaign.updated"
        ? (src.status || "live")
        : "live";

    byId.set(id, {
      id,
      label: src.label || src.name || undefined,
      channel: src.channel || "wa",
      kind: src.kind || "reminder",
      status,
      updated_at: Number(r.ts) || Date.now(),
    });
  }

  return Array.from(byId.values()).filter((c) => c.status !== "archived");
}

/** Guardrail default (virtual) campaign — ensures list is never empty */
function defaultCampaign(origin: string, slug: string) {
  const triggerTest = `${origin}/api/campaigns/autofire?slug=${encodeURIComponent(slug)}&test=1`;
  const triggerNormal = `${origin}/api/campaigns/autofire?slug=${encodeURIComponent(slug)}`;
  return {
    id: "korekko.default.wa.reminders",
    label: "WhatsApp Reminders (Auto)",
    channel: "wa",
    kind: "reminder",
    status: "live",
    actions: {
      autofire_test: triggerTest,
      autofire: triggerNormal,
      reactivate_test: `${origin}/api/campaigns/reactivate?slug=${encodeURIComponent(slug)}&test=1`,
      reactivate: `${origin}/api/campaigns/reactivate?slug=${encodeURIComponent(slug)}`,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || url.searchParams.get("provider_slug") || "").trim();
    const provider_id_qs = (url.searchParams.get("provider_id") || "").trim();

    // Resolve provider
    let provider_id = provider_id_qs;
    if (!provider_id) {
      if (!slug) return NextResponse.json({ ok: false, error: "missing_slug_or_provider_id" }, { status: 400 });
      provider_id = await resolveProviderIdBySlug(slug);
      if (!provider_id) return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    // Read existing campaigns; apply guardrail if none
    const existing = await listExistingCampaigns(provider_id);
    const items = existing.length > 0 ? existing : [defaultCampaign(url.origin, slug || "")];

    return NextResponse.json({
      ok: true,
      provider_id,
      slug: slug || null,
      count: items.length,
      items,
      guardrail: existing.length === 0 ? "virtual_default_active" : "existing",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
