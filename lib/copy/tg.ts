// lib/copy/tg.ts
// Pure copy helpers. No schema changes. Safe to import anywhere.

// Minimal, extendable dictionary for TG-specific phrases.
// Keys = normalized category slugs you already use (e.g., "dentist", "salon").
// Values = array of common service-phrases we may surface in copy.
export const TG_TERMS: Record<string, string[]> = {
  // TG – Dentists
  dentist: [
    "scaling & polishing",
    "cleaning / consultation",
    "first dental visit",
    "RCT (root canal)",
    "braces consult",
    "teeth whitening",
    "extraction",
    "fillings",
  ],

  // TG1 — Beauty & Wellness
  salon: [
    "haircut & styling",
    "hair spa",
    "manicure/pedicure",
    "facial",
    "keratin/smoothening",
    "party makeup",
    "bridal trial",
  ],
  "makeup-artist": [
    "party makeup",
    "bridal makeup",
    "engagement look",
    "sangeet look",
    "base + eye trial",
  ],
  "spa-therapist": [
    "swedish massage",
    "deep tissue",
    "aroma therapy",
    "head/foot massage",
  ],

  // TG2 — Health, Fitness, Learning, Home
  physio: [
    "back pain therapy",
    "knee rehab",
    "posture correction",
    "sports injury care",
    "dry needling",
  ],
  derma: [
    "acne consult",
    "peel session",
    "laser hair reduction",
    "pigmentation care",
    "anti-ageing consult",
  ],
  "gym-trainer": [
    "weight loss plan",
    "muscle gain plan",
    "form check session",
    "diet review call",
  ],
  yoga: [
    "beginners batch",
    "back care yoga",
    "prenatal yoga",
    "therapy session",
    "breathwork basics",
  ],
  tutor: [
    "maths trial class",
    "science doubt-solving",
    "board exam prep",
    "spoken English",
  ],
  plumber: [
    "leak fix",
    "tap replacement",
    "geyser install",
    "blockage clear",
  ],
  electrician: [
    "switchboard fix",
    "fan install",
    "wiring check",
    "appliance fitting",
  ],
};

// Utility: pick a safe display phrase for the UI/copy.
// - If provider.topService is present, prefer that.
// - Else, if we have TG_TERMS[category], pick the first phrase as a sensible default.
// - Else, fall back to generic "appointment/slots".
export function pickServicePhrase(opts: {
  category?: string | null;
  topService?: string | null;
}): string {
  const svc = (opts.topService || "").trim();
  if (svc) return svc;

  const cat = (opts.category || "").toLowerCase().trim();
  const list = cat && TG_TERMS[cat];
  if (list && list.length) return list[0];

  return "appointment / slots";
}

// Helper: get up to N example phrases for a given category to enrich copy.
export function getCategoryExamples(category?: string | null, limit = 4): string[] {
  const cat = (category || "").toLowerCase().trim();
  const list = cat && TG_TERMS[cat];
  if (!list || !list.length) return [];
  return list.slice(0, Math.max(1, Math.min(limit, list.length)));
}
