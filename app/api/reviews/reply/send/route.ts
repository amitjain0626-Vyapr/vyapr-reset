// app/api/reviews/reply/send/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    url.origin ||
    "https://korekko-reset-5rly.vercel.app";

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const { slug = "", text = "", lang = "en", tone = "casual", provider_id = null } = body || {};

  try {
    await fetch(`${origin}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "review.reply.sent",
        ts: Date.now(),
        provider_id: provider_id || null,
        lead_id: null,
        source: { via: "api.reviews.reply.send", slug, lang, tone, size: text?.length || 0 },
      }),
    });
  } catch {}

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
