// @ts-nocheck
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/roi/top-campaigns?slug=<providerSlug>
 * Groups last 30 days by source.utm.campaign (or 'direct').
 * Counts: leads, wa.reminder.sent, wa.rebook.sent
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

    const supa = admin();

    const { data: provider, error: pErr } = await supa
      .from("Providers")
      .select("id")
      .eq("slug", slug)
      .single();

    if (pErr || !provider) {
      return NextResponse.json({ ok: false, error: "unknown slug" }, { status: 404 });
    }

    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const { data: ev, error: eErr } = await supa
      .from("Events")
      .select("event, ts, source, lead_id")
      .eq("provider_id", provider.id)
      .gte("ts", since)
      .in("event", ["lead.created", "wa.reminder.sent", "wa.rebook.sent"]);

    if (eErr) {
      return NextResponse.json({ ok: false, error: eErr.message, rows: [] }, { status: 200 });
    }

    const map = new Map<string, { label: string; leads: number; reminders: number; rebooks: number }>();

    for (const e of ev ?? []) {
      const utm = (e?.source?.utm || {}) as any;
      const label = (utm.campaign || utm.source || "direct") as string;
      if (!map.has(label)) map.set(label, { label, leads: 0, reminders: 0, rebooks: 0 });
      const row = map.get(label)!;
      if (e.event === "lead.created") row.leads += 1;
      if (e.event === "wa.reminder.sent") row.reminders += 1;
      if (e.event === "wa.rebook.sent") row.rebooks += 1;
    }

    const rows = Array.from(map.values()).sort(
      (a, b) => b.leads + b.reminders + b.rebooks - (a.leads + a.reminders + a.rebooks)
    );

    return NextResponse.json({ ok: true, count: rows.length, rows }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "unexpected" }, { status: 200 });
  }
}
