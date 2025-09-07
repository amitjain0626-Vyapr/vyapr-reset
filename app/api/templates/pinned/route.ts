// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns Top 3 pinned templates for a provider by reading recent events
 * and merging with templates.json.
 *
 * GET /api/templates/pinned?slug=amitjain0626
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const origin = url.origin;

  // 1) Fetch pin/unpin events (last N)
  const evRes = await fetch(`${origin}/api/debug/events?limit=1000`);
  const ev = await evRes.json();
  const rows: any[] = ev?.rows || [];

  // Build pin state per template (last event wins)
  const pins: Record<string, { pinned: boolean; ts: number; category?: string }> = {};
  for (const row of rows) {
    const e = row?.event;
    const src = row?.source || {};
    if (!src?.provider_slug || src.provider_slug !== slug) continue;
    if (e !== "template.pinned" && e !== "template.unpinned") continue;

    const tid = src?.template_id;
    if (!tid) continue;

    const ts = row?.ts || 0;
    const prev = pins[tid];
    if (!prev || ts > prev.ts) {
      pins[tid] = { pinned: e === "template.pinned", ts, category: src?.category || undefined };
    }
  }

  // Reduce to only currently pinned
  const current = Object.entries(pins)
    .filter(([, v]) => v.pinned)
    .slice(0, 50); // safety

  // 2) Load templates catalog
  const catRes = await fetch(`${origin}/data/templates.json`, { cache: "no-store" });
  const catJson = await catRes.json();
  const categories = catJson?.categories || {};

  // 3) Build enriched list with title copy from catalog (using category hint if present)
  type Item = { template_id: string; title: string; category: string };
  const result: Item[] = [];
  for (const [tid, meta] of current) {
    let title = tid;
    let chosenCat = meta.category || "";
    if (chosenCat && categories[chosenCat]) {
      const found = (categories[chosenCat] as any[]).find((t) => t.id === tid);
      if (found?.title) title = found.title;
    } else {
      // search all categories (slower but fine for small lists)
      for (const cat of Object.keys(categories)) {
        const found = (categories[cat] as any[]).find((t) => t.id === tid);
        if (found?.title) {
          title = found.title;
          chosenCat = cat;
          break;
        }
      }
    }
    result.push({ template_id: tid, title, category: chosenCat || "unknown" });
  }

  // 4) Limit to top 3 (by most-recent pin ts)
  const top3 = result
    .sort((a, b) => (pins[b.template_id].ts || 0) - (pins[a.template_id].ts || 0))
    .slice(0, 3);

  return NextResponse.json({ ok: true, provider_slug: slug, count: top3.length, items: top3 });
}
