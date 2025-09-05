// app/api/templates/preview/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contract notes:
 * - Telemetry stays strict: {event, ts(ms), provider_id, lead_id, source}.
 * - No schema/name drift. Only adds fields safely.
 * - Preserves legacy response keys: { ok, preview_length, sample }.
 *
 * Query params:
 *   slug: string (provider slug)
 *   template: string (template identifier) OR tid (legacy)
 *   lead_id?: string
 *   slotISO?: string (optional override)
 *   a?: string (audience)
 *   amt?: string/number
 *   cnt?: string/number
 *   exp?: string/number (days)
 *   msg?: string (raw template text with placeholders)
 *   lang?: "en" | "hinglish" | "hi"  (default = "en")
 *   kind?: "no_show_followup" | "reactivation_nudge" | "pre_booking_reminder"
 *   name?: string (customer name override)
 *   profession?: string (NEW — provider profession, e.g., "Dentist", "Astrologer")
 */

const PROVIDER_ID_FALLBACKS: Record<string, string> = {
  amitjain0626: "c56d7dac-c9ed-4828-9c52-56a445fce7b3",
};

async function getJSON<T = any>(href: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(href, { ...init, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function toISTParts(iso?: string | null) {
  if (!iso) return { dateText: null, timeText: null };
  const d = new Date(iso);
  return {
    dateText: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }),
    timeText: d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
  };
}

function pickFallbackSlotISO() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  istNow.setHours(18, 0, 0, 0);
  const past = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (past > istNow) {
    istNow.setDate(istNow.getDate() + 1);
    istNow.setHours(11, 0, 0, 0);
  }
  return new Date(istNow.toLocaleString("en-US", { timeZone: "UTC" })).toISOString();
}

function fillPlaceholders(text: string, vars: Record<string, string | number | null | undefined>) {
  let out = text || "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v == null ? "" : String(v));
  }
  return out;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const slug = q.get("slug") || "";
  const template = q.get("template") || q.get("tid") || "";
  const lead_id = q.get("lead_id") || null;
  const audience = q.get("a") || null;

  const amt = q.get("amt");
  const cnt = q.get("cnt");
  const exp = q.get("exp");
  const msg = q.get("msg") || "";
  const slotOverrideISO = q.get("slotISO");
  const lang = (q.get("lang") || "en").toLowerCase();
  const kind = q.get("kind");
  const nameOverride = (q.get("name") || "").trim();
  const profession = (q.get("profession") || "").trim(); // NEW

  /* ---- provider resolve ---- */
  const providerResolved =
    (await getJSON<{ ok: boolean; id?: string; slug?: string; display_name?: string }>(
      new URL(`/api/providers/resolve?slug=${encodeURIComponent(slug)}`, url.origin).toString()
    )) || null;

  const provider_id = providerResolved?.id || (slug && PROVIDER_ID_FALLBACKS[slug]) || null;
  const provider_name = providerResolved?.display_name || slug || "your service provider";

  /* ---- lead lookup ---- */
  let lead: any = null;
  if (lead_id) {
    const byId = await getJSON<{ ok: boolean; row?: any }>(
      new URL(`/api/leads/by-id?id=${encodeURIComponent(lead_id)}&provider_slug=${encodeURIComponent(slug)}`, url.origin).toString()
    );
    lead = byId?.row || null;
  }

  const derived_name = lead?.patient_name || lead?.name || "valued customer";
  const customer_name = nameOverride || derived_name;
  const customer_phone = lead?.phone || lead?.customer_phone || null;

  /* ---- slot ---- */
  let slotISO: string | null = slotOverrideISO || null;
  if (!slotISO && lead_id) {
    const hist = await getJSON<{ ok: boolean; events?: Array<any> }>(
      new URL(`/api/leads/history?id=${encodeURIComponent(lead_id)}&provider_slug=${encodeURIComponent(slug)}`, url.origin).toString()
    );
    const recentBooking = (hist?.events || []).filter((e) => e?.event === "booking.confirmed").sort((a, b) => (b?.ts || 0) - (a?.ts || 0))[0];
    slotISO = recentBooking?.source?.slotISO || null;
  }
  if (!slotISO) slotISO = pickFallbackSlotISO();
  const { dateText, timeText } = toISTParts(slotISO);

  /* ---- CTAs ---- */
  const cta_collect_url = lead_id
    ? new URL(`/api/track/wa-collect?leadId=${encodeURIComponent(lead_id)}&slug=${encodeURIComponent(slug)}`, url.origin).toString()
    : null;
  const cta_boost_url = new URL(`/api/track/upsell-wa?slug=${encodeURIComponent(slug)}`, url.origin).toString();

  /* ---- placeholders ---- */
  const previewVars = {
    customer_name,
    customer_phone,
    provider_name,
    provider_profession: profession || "", // NEW
    slot_date: dateText,
    slot_time: timeText,
    amount: amt,
    count: cnt,
    expiryDays: exp,
    booking_link: new URL(`/book/${encodeURIComponent(slug || "")}`, url.origin).toString(),
  };

  /* ---- defaults ---- */
  // If profession is present, we add: ", your {provider_profession}"
  const whoSuffix = previewVars.provider_profession ? `, your {provider_profession}` : "";

  const defaultsByLang: Record<string, string> = {
    en:
      `Hello {customer_name}, this is {provider_name}${whoSuffix}. Your preferred slot is {slot_date}, {slot_time}. ` +
      (amt ? "Approx. fee ₹{amount}. " : "") +
      "Please reply to confirm.",
    hinglish:
      `Namaste {customer_name}, {provider_name}${whoSuffix} here. Aapka slot {slot_date}, {slot_time} ka hai. ` +
      (amt ? "Fees approx ₹{amount}. " : "") +
      "Reply karein to confirm.",
    hi:
      `नमस्ते {customer_name}, {provider_name}${whoSuffix} की ओर से। आपका स्लॉट {slot_date}, {slot_time} है। ` +
      (amt ? "अनुमानित शुल्क ₹{amount}। " : "") +
      "कृपया पुष्टि के लिए उत्तर दें।",
  };

  const cannedByKind: Record<string, string> = {
    no_show_followup:
      `Hi {customer_name}, this is {provider_name}${whoSuffix}. We missed you on {slot_date} at {slot_time}. Pick a new slot: {booking_link}`,
    reactivation_nudge:
      `Hi {customer_name}, it’s {provider_name}${whoSuffix}. It’s been a while — book a quick visit: {booking_link}`,
    pre_booking_reminder:
      `Hi {customer_name}, this is {provider_name}${whoSuffix}. Your slot is {slot_date}, {slot_time}. Reply YES to confirm or tap: {booking_link}`,
  };

  const baseText = kind && cannedByKind[kind] ? cannedByKind[kind] : msg || defaultsByLang[lang] || defaultsByLang["en"];
  const text = fillPlaceholders(baseText, previewVars);

  /* ---- telemetry ---- */
  const telemetry = {
    event: "template.preview.requested",
    ts: Date.now(),
    provider_id,
    lead_id,
    source: {
      provider_slug: slug || null,
      template_id: template || null,
      audience,
      placeholders: previewVars,
      lang,
      kind,
      nameOverride: nameOverride || null,
    },
  };
  try {
    await fetch(new URL("/api/events/log", url.origin), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(telemetry) });
  } catch {}

  /* ---- wa deeplink ---- */
  const phoneDigits = (customer_phone || "").toString().replace(/[^\d]/g, "");
  const wa_deeplink = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  /* ---- response ---- */
  return NextResponse.json({
    ok: true,
    wa_deeplink,
    preview_length: (text || "").length,
    sample: (text || "").slice(0, 64),
    text,
    language: lang,
    template,
    provider: { id: provider_id, slug, name: provider_name },
    lead: lead_id ? { id: lead_id, name: customer_name, phone: customer_phone } : null,
    slot: { iso: slotISO, dateText, timeText, tz: "Asia/Kolkata" },
    ctas: { collect: cta_collect_url, boost: cta_boost_url },
    placeholders_resolved: previewVars,
  });
}
