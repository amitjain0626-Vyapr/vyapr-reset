// lib/wa/templates.ts
// WhatsApp/SMS templates — English-first, generic across all categories (Dentist, Dance, Astro, etc.)
// Voice: professional, short, no category-specific words like "clinic".
// Link is appended by the caller (LeadActions / ROI CTA).

import { pickServicePhrase } from "@/lib/copy/tg";

export type WaLang = "en" | "hi"; // default English; Hinglish only when explicitly requested

type WaOpts = {
  name?: string;        // customer name (optional)
  provider?: string;    // provider display name (optional) e.g., "Amit Jain"
  refCode?: string;     // optional reference code to show at the end
  amountINR?: number;   // optional amount to mention

  // INSERTS (optional, no DB/schema drift):
  category?: string | null;   // e.g., "dentist", "physio", "salon", etc.
  topService?: string | null; // provider’s own top/primary service name, if any
};

function firstName(name?: string | null) {
  if (!name) return "";
  return name.trim().split(/\s+/)[0];
}

function teamLine(opts: WaOpts, lang: WaLang) {
  if (opts?.provider && opts.provider.trim()) {
    return lang === "hi"
      ? `yeh ${opts.provider} ki team hai.`
      : `this is ${opts.provider}'s team.`;
  }
  return lang === "hi"
    ? "yeh aapke service provider ki team hai."
    : "this is your service provider’s team.";
}

// Helper: pick a friendly service phrase (category/topService-aware)
function serviceCore(opts: WaOpts): string {
  return pickServicePhrase({
    category: (opts.category || undefined) ?? undefined,
    topService: (opts.topService || undefined) ?? undefined,
  }).trim();
}

function serviceSuffix(opts: WaOpts, lang: WaLang): string {
  const phrase = serviceCore(opts);
  if (!phrase || phrase.toLowerCase() === "appointment / slots") return "";
  return lang === "hi" ? ` — ${phrase} ke liye` : ` for ${phrase}`;
}

function amountLine(amountINR?: number, lang: WaLang = "en") {
  const valid =
    typeof amountINR === "number" && isFinite(amountINR) && amountINR > 0;
  if (!valid) return "";
  const amt = `₹${Math.round(amountINR).toLocaleString("en-IN")}`;
  return lang === "hi" ? ` ${amt}` : ` ${amt}`;
}

function greeting(name?: string, lang: WaLang = "en") {
  const n = firstName(name);
  return n ? (lang === "hi" ? `Hi ${n},` : `Hi ${n},`) : "Hi,";
}

// ---- Primary templates (English default; Hinglish optional) ----
export function waReminder(opts: WaOpts, lang: WaLang = "en"): string {
  const who = teamLine(opts, lang);
  const svc = serviceSuffix(opts, lang);
  const amt = amountLine(opts.amountINR, lang);
  const ref = opts.refCode ? `\nRef: ${opts.refCode}` : "";

  if (lang === "hi") {
    return [
      greeting(opts.name, "hi"),
      `${who} Chhota reminder — aapka payment pending hai${amt}${svc}.`,
      "Payment yahin safe tareeke se kar sakte hain:",
      ref,
    ].join(" ");
  }

  // English (default)
  return [
    greeting(opts.name, "en"),
    `${who} A quick reminder — you have a pending payment${amt}${svc}.`,
    "You can complete it securely here:",
    ref,
  ].join(" ");
}

export function waRebook(opts: WaOpts, lang: WaLang = "en"): string {
  const who = teamLine(opts, lang);
  const svc = serviceSuffix(opts, lang);
  const ref = opts.refCode ? `\nRef: ${opts.refCode}` : "";

  if (lang === "hi") {
    return [
      greeting(opts.name, "hi"),
      `${who} Pichhli baar aap nahi aa paaye — naya slot choose kar sakte hain${svc} yahan:`,
      ref,
    ].join(" ");
  }

  // English (default)
  return [
    greeting(opts.name, "en"),
    `${who} We missed you last time — you can pick a new slot${svc} here:`,
    ref,
  ].join(" ");
}
