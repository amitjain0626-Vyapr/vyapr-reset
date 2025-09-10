// app/api/reviews/reply/preview/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LT = "en" | "hi";
type TN = "formal" | "casual";

function buildEn(tone: TN, who: string, link: string) {
  if (tone === "formal") {
    return [
      `Hello! This is a quick note from ${who}.`,
      `If you had a good experience, could you please spare 30 seconds to leave a short review?`,
      `Your feedback really helps others discover us. Thank you 🙏`,
      ``,
      `Leave a review: ${link}`,
    ].join("\n");
  }
  return [
    `Hey there! 👋 This is ${who}.`,
    `If we made your day a little better, could you drop a quick 1-line review? It really helps others find us.`,
    `Thanks a ton! 🙏`,
    ``,
    `Review link: ${link}`,
  ].join("\n");
}

function buildHi(tone: TN, who: string, link: string) {
  if (tone === "formal") {
    return [
      `नमस्ते! ${who} की तरफ़ से एक छोटा-सा निवेदन।`,
      `अगर आपका अनुभव अच्छा रहा हो तो कृपया 30 सेकंड निकालकर छोटा-सा रिव्यू लिख दें।`,
      `आपकी राय से दूसरे लोगों को भी मदद मिलती है। धन्यवाद 🙏`,
      ``,
      `रिव्यू लिंक: ${link}`,
    ].join("\n");
  }
  return [
    `नमस्ते! 👋 ${who} की तरफ़ से एक छोटा सा निवेदन।`,
    `अगर आपको अच्छा लगा तो 1-लाइन का रिव्यू कर दीजिए — इससे और लोगों को हमें ढूंढने में मदद मिलती है।`,
    `बहुत-बहुत धन्यवाद 🙏`,
    ``,
    `रिव्यू लिंक: ${link}`,
  ].join("\n");
}

function normalizeWho(displayName?: string | null, profession?: string | null) {
  const name = (displayName || "").trim();
  const prof = (profession || "").trim();
  const generic = ["general", "others", "other", "misc", "na", "n/a"];
  const isGeneric = prof && generic.includes(prof.toLowerCase());
  return prof && !isGeneric ? `${name || "your provider"}, your ${prof}` : (name || "your provider");
}

async function resolveProvider(origin: string, slug: string) {
  try {
    const res = await fetch(`${origin}/api/providers/resolve?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.ok ? { display: j.display_name, profession: j.profession } : null;
  } catch { return null; }
}

async function logEvent(origin: string, body: any) {
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
  const lang = (url.searchParams.get("lang") || "en") as LT;
  const tone = (url.searchParams.get("tone") || "casual") as TN;

  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: "missing slug" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL || url.origin || "https://korekko-reset-5rly.vercel.app";
  const link = `${origin}/review/${encodeURIComponent(slug)}`;

  // Resolve provider → display + profession
  const resolved = await resolveProvider(origin, slug);
  const who = normalizeWho(resolved?.display, resolved?.profession);

  // Build messages
  const preview = {
    en: { casual: buildEn("casual", who, link), formal: buildEn("formal", who, link) },
    hi: { casual: buildHi("casual", who, link), formal: buildHi("formal", who, link) },
  };
  const text = (preview[lang] && preview[lang][tone]) || preview.en.casual;

  // Telemetry (best-effort)
  logEvent(origin, {
    event: "review.reply.previewed",
    ts: Date.now(),
    provider_id: null,
    lead_id: null,
    source: { via: "api.reviews.reply.preview", slug, lang, tone, resolved: !!resolved },
  });

  return new Response(JSON.stringify({ ok: true, slug, lang, tone, preview, text }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
