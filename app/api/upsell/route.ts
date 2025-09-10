// app/api/upsell/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(json: any, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function bad(msg: string, status = 400) {
  return ok({ ok: false, error: msg }, status);
}

async function log(origin: string, body: any) {
  try {
    await fetch(`${origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {}
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) return bad("missing_slug");

  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    url.origin ||
    "https://korekko-reset-5rly.vercel.app";

  // Pull existing CTAs (server-to-server)
  const [collectRes, boostRes] = await Promise.all([
    fetch(`${origin}/api/roi/cta/collect?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(r => r.json()).catch(() => null),
    fetch(`${origin}/api/roi/cta/boost?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(r => r.json()).catch(() => null),
  ]);

  const collectItems = Array.isArray(collectRes?.items) ? collectRes.items : [];
  const boostSuggestions = Array.isArray(boostRes?.suggestions) ? boostRes.suggestions : [];

  const firstCollect = collectItems[0];
  const collectAction =
    (firstCollect?.wa_url && String(firstCollect.wa_url)) ||
    `${origin}/api/roi/cta/collect?slug=${encodeURIComponent(slug)}`;

  const firstBoost = boostSuggestions[0];
  const boostAction =
    (firstBoost?.action_url && String(firstBoost.action_url)) ||
    `/upsell?slug=${encodeURIComponent(slug)}`;

  const nudges = [
    {
      key: "collect",
      label: "Collect pending payments",
      kind: "collect",
      action_url: collectAction,
      meta: { pending_count: collectItems.length },
    },
    {
      key: "boost",
      label: "Boost visibility",
      kind: "boost",
      action_url: boostAction.startsWith("/") ? boostAction : `/${boostAction}`,
      meta: { suggestions: boostSuggestions.length },
    },
  ];

  // Telemetry
  log(origin, {
    event: "upsell.nudge.viewed",
    ts: Date.now(),
    provider_id: null,
    lead_id: null,
    source: { via: "api.upsell", slug, nudges: nudges.map(n => n.key) },
  });

  return ok({ ok: true, slug, nudges });
}
