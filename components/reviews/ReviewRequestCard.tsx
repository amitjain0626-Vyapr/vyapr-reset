// components/reviews/ReviewRequestCard.tsx
// @ts-nocheck
"use client";

import * as React from "react";

type Props = {
  slug: string;
  providerId?: string | null;
  providerName?: string | null; // optional hint; we'll still try resolver
  lang?: "en" | "hi";
  tone?: "formal" | "casual";
  amountHintInr?: number; // optional, not used for ORM but kept for parity
};

const encode = (s: string) => encodeURIComponent(s);

function titleCase(s: string) {
  return (s || "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function humanizeSlug(slug: string) {
  // e.g., "amit-jain-dentist" -> "Amit Jain Dentist"
  // "amitjain0626" -> "Amitjain0626" (best-effort)
  const spaced = slug.includes("-") || slug.includes("_") ? slug : slug;
  return titleCase(spaced);
}

function pickProfession(profession?: string, category?: string) {
  const p = (profession || "").trim();
  const c = (category || "").trim();
  // Treat generic labels as "no profession"
  const generic = ["general", "others", "other", "misc", "na", "n/a", ""];
  const isGeneric = (v: string) => generic.includes(v.toLowerCase());
  if (p && !isGeneric(p)) return titleCase(p);
  if (c && !isGeneric(c)) return titleCase(c);
  return "";
}

export default function ReviewRequestCard({
  slug,
  providerId,
  providerName,
  lang = "en",
  tone = "casual",
}: Props) {
  const origin =
    (typeof window !== "undefined" && window.location?.origin) ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://vyapr-reset-5rly.vercel.app";

  // Resolved provider display + profession
  const [display, setDisplay] = React.useState<string>(providerName || "");
  const [profession, setProfession] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${origin}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!cancelled && j) {
          // Prefer display_name → name → prop → humanized slug
          const rawName =
            j.display_name || j.name || providerName || humanizeSlug(slug) || slug;
          const finalName =
            rawName === slug ? providerName || humanizeSlug(slug) : rawName;

          setDisplay(finalName);
          setProfession(pickProfession(j.profession, j.category));
        }
      } catch {
        if (!cancelled) {
          setDisplay(providerName || humanizeSlug(slug) || slug);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const link = `${origin}/review/${encodeURIComponent(slug)}`;

  // Build text with resolved name + profession
  const message =
    lang === "hi"
      ? buildHiTemplate(display || providerName || humanizeSlug(slug) || slug, profession, link, tone)
      : buildEnTemplate(display || providerName || humanizeSlug(slug) || slug, profession, link, tone);

  async function log(event: string, extra?: any) {
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          ts: Date.now(),
          provider_id: providerId ?? null,
          lead_id: null,
          source: { via: "reviews.page", slug, lang, tone, display, profession, ...extra },
        }),
      });
    } catch {}
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    await log("review.request.copied");
    alert("Copied the review request message.");
  }

  async function handleWhatsapp() {
    await log("review.request.started");
    const url = `https://api.whatsapp.com/send?text=${encode(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">
          {lang === "hi" ? "हिंदी टेम्पलेट" : "English template"} •{" "}
          {tone === "formal" ? "Formal" : "Casual"}
        </h3>
        <span className="text-xs text-gray-500">ORM Lite</span>
      </div>
      <textarea
        readOnly
        value={message}
        className="w-full h-40 rounded-xl border p-3 text-sm font-[450] leading-6"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleCopy}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Copy message
        </button>
        <button
          onClick={handleWhatsapp}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
        >
          Open WhatsApp
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => log("review.link.previewed")}
          className="ml-auto text-sm underline"
        >
          Preview review link →
        </a>
      </div>
    </div>
  );
}

// Builders include profession if present
function buildEnTemplate(providerDisplay: string, profession: string, link: string, tone: "formal" | "casual") {
  const who = profession ? `${providerDisplay}, your ${profession}` : providerDisplay;
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

function buildHiTemplate(providerDisplay: string, profession: string, link: string, tone: "formal" | "casual") {
  const who = profession ? `${providerDisplay}, आपके ${profession}` : providerDisplay;
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
