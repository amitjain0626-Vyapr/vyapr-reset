// app/api/campaigns/reactivate/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waRebook } from "@/lib/wa/templates";

/* ----------------------------- lang helpers ------------------------------ */
/* No schema drift. English default. Honors: ?lang → cookie(korekko.lang) → Providers.lang_pref → "en" */
type Lang = "en" | "hi";
function normalizeLangToken(v?: string | null): "en" | "hi" | "hinglish" | null {
  const t = (v || "").toLowerCase().trim();
  if (t === "en") return "en";
  if (t === "hi") return "hi";
  if (t === "hinglish") return "hinglish";
  return null;
}
async function resolveProviderLangPref(origin: string, slug: string): Promise<Lang | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${origin}/api/providers/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return normalizeLangToken(json?.lang_pref || json?.provider?.lang_pref);
  } catch {
    return null;
  }
}
async function resolveLang(req: NextRequest, slug: string): Promise<Lang> {
  const url = new URL(req.url);
  const qLang = normalizeLangToken(url.searchParams.get("lang"));
  if (qLang) return qLang;
  const cookieLang = normalizeLangToken(req.cookies.get("korekko.lang")?.value);
  if (cookieLang) return cookieLang;
  const pref = await resolveProviderLangPref(url.origin, slug);
  return pref || "en";
}

/* -------------------------------- helpers -------------------------------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveProviderId(
  sb: any,
  { provider_id, provider_slug }: { provider_id?: string | null; provider_slug?: string | null }
) {
  if (provider_id) return provider_id;
  if (!provider_slug) return null;
  const { data, error } = await sb.from("Providers").select("id").eq("slug", String(provider_slug).trim()).maybeSingle();
  if (error) return null;
  return data?.id || null;
}

async function resolveProviderInfo(
  sb: any,
  { provider_id, provider_slug }: { provider_id?: string | null; provider_slug?: string | null }
) {
  let row: any = null;
  if (provider_id) {
    const { data } = await sb.from("Providers").select("id, slug, name, business_name").eq("id", provider_id).maybeSingle();
    row = data;
  } else if (provider_slug) {
    const { data } = await sb.from("Providers").select("id, slug, name, business_name").eq("slug", provider_slug).maybeSingle();
    row = data;
  }
  if (!row) return { id: null, slug: null, display: null };
  return {
    id: row.id || null,
    slug: row.slug || null,
    display: (row.business_name || row.name || "").trim() || null,
  };
}

async function getNudgeConfig(origin: string, slug: string) {
  try {
    const res = await fetch(`${origin}/api/cron/nudges?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const json = await res.json();
    return {
      ok: !!json?.ok,
      provider_id: json?.provider_id || null,
      quiet_start: json?.config?.quiet_start ?? 22,
      quiet_end: json?.config?.quiet_end ?? 8,
      cap: json?.config?.cap ?? 25,
      remaining: json?.remaining ?? 0,
      is_quiet: !!json?.is_quiet,
      allowed: !!json?.allowed,
    };
  } catch {
    return { ok: false, provider_id: null, quiet_start: 22, quiet_end: 8, cap: 25, remaining: 0, is_quiet: true, allowed: false };
  }
}

async function logEvent_direct(
  sb: any,
  payload: { event: string; ts?: number; provider_id: string; lead_id?: string | null; source?: any }
) {
  const row = {
    event: payload.event,
    ts: payload.ts || Date.now(),
    provider_id: payload.provider_id,
    lead_id: payload.lead_id ?? null,
    source: typeof payload.source === "object" && payload.source !== null ? payload.source : {},
  };
  const { error } = await sb.from("Events").insert(row);
  if (error) throw new Error(error.message || "insert_failed");
}

/* ----------------------- template catalog (legacy) ------------------------ */
/* Kept for backwards-compat preview; new preview uses waRebook() */
const TEMPLATES: Record<string, { body: string }> = {
  "korekko.default.reactivation.1": {
    body: "👋 Hi {{name}}, it’s {{provider}}. Haven’t seen you in a while — book your next appointment today? Tap here: {{link}}",
  },
  "korekko.default.reminder.1": {
    body: "⏰ Reminder: Healthy smiles need regular care 😁 — schedule now: {{link}}",
  },
  "korekko.default.offer.1": {
    body: "🎉 Special for returning patients — limited slots this week. Book here: {{link}}",
  },
  "wa.confirm.booking": {
    body: "Hello {{name}}, this is {{provider}}.\nYour appointment is on {{date}} at {{time}}.\nReply YES to confirm, or tap to reschedule: {{link}}",
  },
  "wa.reactivate.lapsed": {
    body: "Hi {{name}}, we noticed it’s been a while. Book a quick visit with {{provider}} — it takes 10 sec: {{link}}",
  },
};

function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (vars?.[k] ?? "").toString());
}

function waUrlFor(phone: string, text: string) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(text || "");
  if (!digits) return `https://api.whatsapp.com/send/?text=${msg}&type=phone_number&app_absent=0`;
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${msg}&type=phone_number&app_absent=0`;
}

/* ---------------- selection logic (unchanged for sends) ------------------- */
const LAPSE_DAYS = 30;
const COOL_OFF_DAYS = 14;

async function listProviderLeadIds(sb: any, provider_id: string, limit = 2000) {
  const { data, error } = await sb
    .from("Leads")
    .select("id")
    .eq("provider_id", provider_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r: any) => r.id);
}

async function lastEventTsMap(sb: any, provider_id: string, eventNames: string[], leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, number>();
  const { data, error } = await sb
    .from("Events")
    .select("lead_id, event, ts")
    .eq("provider_id", provider_id)
    .in("event", eventNames)
    .in("lead_id", leadIds)
    .order("ts", { ascending: false })
    .limit(5000);
  if (error) return new Map<string, number>();
  const map = new Map<string, number>();
  for (const r of data || []) {
    const k = String(r.lead_id);
    if (!map.has(k)) map.set(k, Number(r.ts) || 0);
  }
  return map;
}

/* -------------------------------- handlers -------------------------------- */
export async function POST(req: NextRequest) {
  const sb = admin();
  const url = new URL(req.url);
  const origin = url.origin;

  // Decide language for preview/sends
  const slugForLang = (url.searchParams.get("slug") || "").trim();
  const lang = await resolveLang(req, slugForLang);

  // Query inputs (kept as-is for compatibility)
  const slug = slugForLang;
  const test = url.searchParams.get("test") === "1";
  const testLeadId = (url.searchParams.get("lead_id") || "").trim();

  // Body inputs for preview (backward-compatible)
  let bodyJSON: any = {};
  try {
    bodyJSON = await req.json();
  } catch {}
  const template_key = (bodyJSON?.template_key || "").trim();
  const channel = (bodyJSON?.channel || "whatsapp").trim().toLowerCase();
  const preview = !!bodyJSON?.preview;
  const vars = (bodyJSON?.vars || {}) as Record<string, string>;
  const category = (bodyJSON?.category || "").trim().toLowerCase();
  const service = (bodyJSON?.service || "").trim();

  if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

  // Resolve provider for display/link defaults (even for preview)
  const prov = await resolveProviderInfo(sb, { provider_slug: slug });
  const provider_id = prov.id || (await resolveProviderId(sb, { provider_slug: slug }));
  if (!provider_id) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });

  /* ------------------------- NEW: PREVIEW branch ------------------------- */
  if (preview) {
    // Generate TG-aware, multi-language reactivation copy
    const text = waRebook(
      {
        name: vars.name || "there",
        provider: vars.provider || prov.display || "your service provider",
        refCode: vars.ref || "",
        amountINR: Number(vars.amount || 0) || undefined,
        category: (vars.category || category || "") || null,
        topService: (vars.service || service || "") || null,
      },
      lang
    );
    const wa_url = waUrlFor(vars.phone || "", text);

    return NextResponse.json({
      ok: true,
      preview: {
        provider_id,
        provider_slug: slug,
        language: lang,
        category: category || vars.category || null,
        service: service || vars.service || null,
        text,
        whatsapp_url: wa_url,
      },
    });
  }

  /* ---------------- EXISTING behaviors kept intact ---------------------- */
  // TEST mode: send one sample reactivation immediately
  if (test) {
    const lead_id = testLeadId || null;
    await logEvent_direct(sb, {
      event: "wa.reactivation.sent",
      provider_id,
      lead_id,
      source: {
        channel: "whatsapp",
        template: "korekko.default.reactivation",
        mode: "test",
        lang, // record chosen language (allowed inside source)
      },
    });
    return NextResponse.json({ ok: true, mode: "test", provider_id, sent: 1, used_lead_id: lead_id });
  }

  // NORMAL mode: respect quiet hours + cap
  const cfg = await getNudgeConfig(origin, slug);
  if (!cfg.ok) return NextResponse.json({ ok: false, error: "nudges_config_unavailable" }, { status: 503 });
  if (!cfg.allowed) {
    return NextResponse.json({
      ok: true,
      allowed: false,
      reason: cfg.is_quiet ? "quiet_hours" : "cap_exhausted",
      remaining: cfg.remaining,
      sent: 0,
    });
  }

  // Build candidate set
  const allLeadIds = await listProviderLeadIds(sb, provider_id);
  if (allLeadIds.length === 0) return NextResponse.json({ ok: true, sent: 0, reason: "no_leads" });

  const now = Date.now();
  const lapseCutoff = now - LAPSE_DAYS * 24 * 60 * 60 * 1000;
  const coolOffCutoff = now - COOL_OFF_DAYS * 24 * 60 * 60 * 1000;

  const recentBookingTs = await lastEventTsMap(sb, provider_id, ["booking.confirmed", "lead.booked", "payment.recorded"], allLeadIds);
  const recentReactivationTs = await lastEventTsMap(sb, provider_id, ["wa.reactivation.sent"], allLeadIds);

  const candidates: string[] = [];
  for (const leadId of allLeadIds) {
    const lastBooked = recentBookingTs.get(String(leadId)) || 0;
    const lastReactivated = recentReactivationTs.get(String(leadId)) || 0;
    const isLapsed = lastBooked === 0 || lastBooked < lapseCutoff;
    const cooled = lastReactivated === 0 || lastReactivated < coolOffCutoff;
    if (isLapsed && cooled) candidates.push(String(leadId));
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_lapsed_candidates" });
  }

  // Respect remaining cap
  const max = Math.max(0, Number(cfg.remaining || 0));
  const final = candidates.slice(0, max);

  let sent = 0;
  for (const lead_id of final) {
    await logEvent_direct(sb, {
      event: "wa.reactivation.sent",
      provider_id,
      lead_id,
      source: {
        channel: "whatsapp",
        template: "korekko.default.reactivation",
        lang, // record chosen language
      },
    });
    sent++;
  }

  return NextResponse.json({
    ok: true,
    mode: "normal",
    provider_id,
    attempted: candidates.length,
    sent,
    remaining_after: Math.max(0, max - sent),
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    route: "/api/campaigns/reactivate",
    usage: {
      preview: {
        method: "POST",
        url: `${url.origin}/api/campaigns/reactivate?slug=YOUR_SLUG`,
        body: {
          preview: true,
          template_key: "korekko.default.reactivation.1",
          channel: "whatsapp",
          vars: { name: "Amit", provider: "Dr. Amit", link: `${url.origin}/book/YOUR_SLUG` }
        }
      },
      test: `${url.origin}/api/campaigns/reactivate?slug=YOUR_SLUG&test=1&lead_id=OPTIONAL_LEAD_ID  (POST)`,
      normal: `${url.origin}/api/campaigns/reactivate?slug=YOUR_SLUG  (POST)`,
    },
    rules: {
      lapse_days: LAPSE_DAYS,
      cool_off_days: COOL_OFF_DAYS,
    },
  });
}
