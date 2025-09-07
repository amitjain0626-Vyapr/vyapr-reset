// lib/wa/templates.ts
// WhatsApp/SMS templates — English-first, generic across all categories (Dentist, Dance, Astro, etc.)
// Voice: professional by default; optional “Veli” (friendly) tone helpers included.
// Link is appended by the caller (LeadActions / ROI CTA / debug endpoints).

import { pickServicePhrase } from "@/lib/copy/tg";

export type WaLang = "en" | "hinglish" | "hi";

type WaOpts = {
  name?: string;        // customer name (optional)
  provider?: string;    // provider display name (optional) e.g., "Amit Jain"
  refCode?: string;     // optional reference code to show at the end
  amountINR?: number;   // optional amount to mention

  // Optional hints (no DB/schema drift):
  category?: string | null;   // e.g., "dentist", "physio", "salon", etc.
  topService?: string | null; // provider’s own top/primary service name, if any
  profession?: string | null; // NEW: customer-facing role label, e.g., "Dentist", "Yoga Instructor"
};

function firstName(name?: string | null) {
  if (!name) return "";
  return name.trim().split(/\s+/)[0];
}

/** Normalize profession tokens to a friendly label (English UI). */
function normalizeProfession(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  const map: Record<string, string> = {
    dentist: "Dentist",
    dental: "Dentist",
    astro: "Astrologer",
    astrologer: "Astrologer",
    dance: "Dance Instructor",
    dancer: "Dance Instructor",
    physio: "Physiotherapist",
    physiotherapist: "Physiotherapist",
    derma: "Dermatologist",
    dermatologist: "Dermatologist",
    salon: "Stylist",
    fitness: "Fitness Coach",
    trainer: "Fitness Coach",
    yoga: "Yoga Instructor",
    tutor: "Tutor",
    tuition: "Tutor",
    plumber: "Plumber",
    electrician: "Electrician",
  };
  return map[s] || (raw.charAt(0).toUpperCase() + raw.slice(1));
}

/** Build “who” line. Prefers provider name; optionally appends a role, e.g., “your Dentist”. */
function teamLine(opts: WaOpts) {
  const role = normalizeProfession(opts?.profession || opts?.category || undefined);
  const roleBit = role ? `, your ${role}` : "";
  if (opts?.provider && opts.provider.trim()) return `this is ${opts.provider}'s team${roleBit}.`;
  // generic
  return `this is your service provider’s team${roleBit}.`;
}

// Helper: pick a friendly service phrase (category/topService-aware)
// Returns leading space so it can be appended naturally (or empty string).
function servicePhrase(opts: WaOpts): string {
  const phrase = pickServicePhrase({
    category: (opts.category || undefined) ?? undefined,
    topService: (opts.topService || undefined) ?? undefined,
  }).trim();

  // Only add “ for <phrase>” when phrase is not the generic fallback.
  if (!phrase || phrase.toLowerCase() === "appointment / slots") return "";
  return ` for ${phrase}`;
}

/* =========================================================================
 * Primary templates (English default)
 * ========================================================================= */

export function waReminder(opts: WaOpts, lang: WaLang = "en"): string {
  const n = firstName(opts.name);
  const who = teamLine(opts);
  const svc = servicePhrase(opts); // e.g., " for scaling & polishing"
  const amt =
    typeof opts.amountINR === "number" &&
    isFinite(opts.amountINR) &&
    opts.amountINR > 0
      ? ` of ₹${Math.round(opts.amountINR).toLocaleString("en-IN")}`
      : "";
  const ref = opts.refCode ? `\nRef: ${opts.refCode}` : "";

  const templates: Record<WaLang, string> = {
    en: [
      n ? `Hi ${n},` : "Hi,",
      `${who} A quick reminder — you have a pending payment${amt}${svc}.`,
      "You can complete it securely here:",
      ref,
    ].join(" "),
    hinglish: [
      n ? `Hi ${n},` : "Hi,",
      `${who} Ek chhota reminder — aapka payment pending hai${amt}${svc}.`,
      "Yahan se aaram se complete kar sakte hain:",
      ref,
    ].join(" "),
    hi: [
      n ? `नमस्ते ${n},` : "नमस्ते,",
      `${who.replace("this is", "यह")} एक छोटा सा स्मरण — आपका भुगतान लंबित है${svc ? svc.replace(" for ", " — ") : ""}${amt ? ` (${amt.replace(" of ", " ")})` : ""}।`,
      "कृपया यहाँ से सुरक्षित रूप से पूरा करें:",
      ref,
    ].join(" "),
  };

  return templates[lang] || templates.en;
}

export function waRebook(opts: WaOpts, lang: WaLang = "en"): string {
  const n = firstName(opts.name);
  const who = teamLine(opts);
  const svc = servicePhrase(opts); // e.g., " for back pain therapy"
  const ref = opts.refCode ? `\nRef: ${opts.refCode}` : "";

  const templates: Record<WaLang, string> = {
    en: [
      n ? `Hi ${n},` : "Hi,",
      `${who} We missed you last time — you can pick a new slot${svc} here:`,
      ref,
    ].join(" "),
    hinglish: [
      n ? `Hi ${n},` : "Hi,",
      `${who} Pichhli baar aap nahi aa paaye — naya slot choose kar sakte hain${svc} yahan:`,
      ref,
    ].join(" "),
    hi: [
      n ? `नमस्ते ${n},` : "नमस्ते,",
      `${who.replace("this is", "यह")} पिछली बार आप नहीं आ पाए — आप नया स्लॉट चुन सकते हैं${svc ? svc.replace(" for ", " — ") : ""} यहाँ:`,
      ref,
    ].join(" "),
  };

  return templates[lang] || templates.en;
}

/* =========================================================================
 * Optional “Veli tone” (friendly) variants — English default
 * Keep messages short, human, and category-agnostic.
 * Callers can opt-in; existing flows remain unchanged.
 * ========================================================================= */

export function waReminderVeli(opts: WaOpts, lang: WaLang = "en"): string {
  const n = firstName(opts.name);
  const role = normalizeProfession(opts?.profession || opts?.category || undefined);
  const who =
    opts?.provider && opts.provider.trim()
      ? `${opts.provider}’s team${role ? `, your ${role}` : ""}`
      : `your service team${role ? `, your ${role}` : ""}`;
  const svc = servicePhrase(opts);
  const amt =
    typeof opts.amountINR === "number" && isFinite(opts.amountINR) && opts.amountINR > 0
      ? ` (₹${Math.round(opts.amountINR).toLocaleString("en-IN")})`
      : "";

  const t: Record<WaLang, string> = {
    en: `${n ? "Hey " + n : "Hey"}, ${who} here — quick nudge: payment${amt}${svc} pending. Pay here:`,
    hinglish: `${n ? "Hey " + n : "Hey"}, ${who} yahan — ek chhota nudge: payment${amt}${svc} pending hai. Yahan pay karein:`,
    hi: `${n ? "नमस्ते " + n : "नमस्ते"}, ${who} की ओर से — छोटा स्मरण: भुगतान${amt}${svc ? svc.replace(" for ", " — ") : ""} लंबित है। यहाँ करें:`,
  };
  return t[lang] || t.en;
}

export function waRebookVeli(opts: WaOpts, lang: WaLang = "en"): string {
  const n = firstName(opts.name);
  const role = normalizeProfession(opts?.profession || opts?.category || undefined);
  const who =
    opts?.provider && opts.provider.trim()
      ? `${opts.provider}’s team${role ? `, your ${role}` : ""}`
      : `your service team${role ? `, your ${role}` : ""}`;
  const svc = servicePhrase(opts);

  const t: Record<WaLang, string> = {
    en: `${n ? "Hey " + n : "Hey"}, ${who} here — missed you last time. Pick a new slot${svc}:`,
    hinglish: `${n ? "Hey " + n : "Hey"}, ${who} yahan — pichhli baar miss ho gaya. Naya slot choose karein${svc}:`,
    hi: `${n ? "नमस्ते " + n : "नमस्ते"}, ${who} की ओर से — पिछली बार छूट गया। नया स्लॉट चुनें${svc ? svc.replace(" for ", " — ") : ""}:`,
  };
  return t[lang] || t.en;
}
