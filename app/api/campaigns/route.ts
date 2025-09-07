// app/api/cron/campaigns/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

async function fire(origin: string, path: string, slug: string, test: boolean) {
  const url = `${origin}${path}?slug=${encodeURIComponent(slug)}${test ? "&test=1" : ""}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } }).catch(() => null);
  const json = await res?.json().catch(() => ({}));
  return { path, status: res?.status || 0, json };
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const slug = (url.searchParams.get("slug") || "").trim();
  const test = url.searchParams.get("test") === "1"; // test mode passthrough

  if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

  const [reminders, reactivation] = await Promise.all([
    fire(origin, "/api/campaigns/autofire", slug, test),
    fire(origin, "/api/campaigns/reactivate", slug, test),
  ]);

  return NextResponse.json({
    ok: true,
    slug,
    mode: test ? "test" : "normal",
    results: { reminders, reactivation },
  });
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  return NextResponse.json({
    ok: true,
    route: "/api/cron/campaigns",
    usage: {
      test: `${u.origin}/api/cron/campaigns?slug=YOUR_SLUG&test=1  (POST)`,
      normal: `${u.origin}/api/cron/campaigns?slug=YOUR_SLUG  (POST)`,
    },
  });
}
