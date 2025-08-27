// lib/wa/templates.ts
// @ts-nocheck

export type WaParams = {
  name?: string;                 // "Aisha"
  provider?: string;             // "Dr. Kapoor Clinic"
  slug?: string;                 // "amitjain0626"
  slot?: string;                 // "Tue 4:30 PM"
  link?: string;                 // optional absolute override (e.g., prod domain)
  // Attribution
  leadId?: string;               // used as ?lid=
  kind?: "reminder" | "rebook";  // used for utm_campaign (fallback)
  campaign?: string;             // explicit utm_campaign
};

// ---------- internals (robust UTM builder; no URL ctor) ----------
function buildQuery(obj: Record<string, any>) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function appendParams(rawUrl: string, params: Record<string, any>) {
  const hashIdx = rawUrl.indexOf("#");
  const hasFragment = hashIdx >= 0;
  const base = hasFragment ? rawUrl.slice(0, hashIdx) : rawUrl;
  const frag = hasFragment ? rawUrl.slice(hashIdx) : "";
  const sep = base.includes("?") ? "&" : "?";
  const qs = buildQuery(params);
  return qs ? `${base}${sep}${qs}${frag}` : rawUrl;
}

function getOrigin() {
  try {
    if (typeof window !== "undefined" && window?.location?.origin) {
      return window.location.origin; // e.g., https://vyapr-reset-5rly.vercel.app
    }
  } catch {}
  // server-side fallback (prod canonical)
  return "https://vyapr.com";
}

function buildBookingLink(p: WaParams) {
  const origin = getOrigin();
  const base =
    p.link ||
    (p.slug ? `${origin}/book/${p.slug}` : origin); // dev uses current origin; prod can pass link
  const params = {
    utm_source: "whatsapp",
    utm_medium: "message",
    utm_campaign: p.campaign || p.kind || "general",
    utm_content: "vyapr-default",
    lid: p.leadId || "",
  };
  return appendParams(base, params);
}
// -----------------------------------------------------------------

export function waReminder(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "your clinic").trim();
  const slot = (p.slot || "").trim();
  const link = buildBookingLink({ ...p, kind: "reminder" });

  const line1 = `Hi${who}, quick reminder from ${provider}.`;
  const line2 = slot ? `Can we confirm your ${slot} appointment?` : `Can we confirm your appointment?`;
  const line3 = `Reply YES to confirm or pick another time: ${link}`;
  return `${line1} ${line2} ${line3}`;
}

export function waRebook(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "your clinic").trim();
  const link = buildBookingLink({ ...p, kind: "rebook" });

  const line1 = `Hi${who}, this is ${provider}.`;
  const line2 = `We missed you last time — want to rebook for this week?`;
  const line3 = link;
  return `${line1} ${line2} ${line3}`;
}

// Public helper: tracked booking link (same UTM rules)
export function waBookingLink(p: WaParams) {
  return buildBookingLink(p);
}

// Extras (kept for GTM library growth)
export function waThankYou(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "our clinic").trim();
  return `Thanks${who} for visiting ${provider} today. If anything felt off, just reply here — we’ll make it right.`;
}

export function waReviewNudge(p: WaParams) {
  const provider = (p.provider || "our clinic").trim();
  const link = buildBookingLink(p);
  return `It'd mean a lot if you could rate ${provider}. It helps others discover us: ${link}`;
}
