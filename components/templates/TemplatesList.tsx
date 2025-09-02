// components/templates/TemplatesList.tsx
"use client";
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

type TemplateKind = "offer" | "rebook_post" | "thankyou_post" | "new_patient" | "no_show";
type Lang = "en" | "hi";
type Audience = "all" | "new" | "repeat";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function buildBookingLink(origin: string, slug: string) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const u = new URL(`/book/${encodeURIComponent(slug || "")}`, base);
  u.searchParams.set("utm_source", "whatsapp");
  u.searchParams.set("utm_medium", "message");
  u.searchParams.set("utm_campaign", "template-pack");
  return u.toString();
}

function readSlugFallback(slugProp?: string) {
  if (slugProp) return slugProp;
  try {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("slug");
    if (s) return s.trim();
  } catch {}
  return "";
}

async function resolveProviderIdFromEvents(): Promise<string | null> {
  try {
    const res = await fetch(`/api/debug/events?limit=50`, { cache: "no-store" });
    const j = await res.json();
    if (j?.rows && Array.isArray(j.rows)) {
      for (const r of j.rows) {
        if (r?.provider_id) return r.provider_id;
      }
    }
  } catch {}
  return null;
}

function redirectUrl(
  event: string,
  kind: TemplateKind,
  slug: string,
  pid: string | null,
  text: string,
  audience: Audience,
  mediaUrl?: string | null
) {
  const params = new URLSearchParams();
  params.set("e", event);
  params.set("kind", kind);
  if (slug) params.set("slug", slug);
  if (pid) params.set("pid", pid);
  params.set("aud", audience);
  if (mediaUrl) params.set("media", mediaUrl);
  params.set("text", text);
  return `/api/events/redirect?${params.toString()}`;
}

async function fetchRecentEvents(): Promise<any[]> {
  try {
    const res = await fetch(`/api/debug/events?limit=200`, { cache: "no-store" });
    const j = await res.json();
    return Array.isArray(j?.rows) ? j.rows : [];
  } catch {
    return [];
  }
}

function within7d(tsMs: number) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return now - tsMs <= sevenDays;
}

// NEW: provider meta (category/services)
type ProviderMeta = {
  provider?: { id?: string; slug?: string; display_name?: string; category?: string; location?: string } | null;
  services?: Array<{ name: string }>;
};
async function fetchProviderMeta(slug: string): Promise<ProviderMeta> {
  if (!slug) return {};
  try {
    const r = await fetch(`${SITE}/api/providers/meta?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = await r.json();
    return j || {};
  } catch {
    return {};
  }
}

export default function TemplatesList({ slug }: { slug?: string }) {
  const [origin] = useState<string>(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [providerId, setProviderId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem("vyapr.lang") as Lang) || "en"; } catch {}
    return "en";
  });
  const [aud, setAud] = useState<Audience>(() => {
    try { return (localStorage.getItem("vyapr.audience") as Audience) || "all"; } catch {}
    return "all";
  });
  const [analytics, setAnalytics] = useState<Record<string, { sent7d: number; opens7d: number }>>({});
  const effectiveSlug = readSlugFallback(slug);

  // NEW: TG meta
  const [meta, setMeta] = useState<ProviderMeta>({});
  useEffect(() => {
    let on = true;
    (async () => {
      const m = await fetchProviderMeta(effectiveSlug);
      if (on) setMeta(m || {});
    })();
    return () => { on = false; };
  }, [effectiveSlug]);

  const category = (meta?.provider?.category || "").toLowerCase();
  const isDentist = /dent(ist|al)/i.test(category);
  const topService = meta?.services?.[0]?.name || "";

  // Resolve providerId
  useEffect(() => {
    let on = true;
    (async () => {
      const id = await resolveProviderIdFromEvents();
      if (on) setProviderId(id);
    })();
    return () => { on = false; };
  }, []);

  // Persist UI prefs
  useEffect(() => { try { localStorage.setItem("vyapr.lang", lang); } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem("vyapr.audience", aud); } catch {} }, [aud]);

  // TG-aware phrasing helpers
  function tgTerm(nameEn: string, nameHi?: string) {
    if (isDentist) return lang === "hi" ? (nameHi || nameEn) : nameEn;
    return lang === "hi" ? (nameHi || nameEn) : nameEn;
  }
  const link = buildBookingLink(origin, effectiveSlug || "");

  // Prepare base text dictionaries (with TG-aware placeholders)
  const baseText = useMemo(() => {
    // Defaults
    const en = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        const svc = topService || (isDentist ? "dental checkup" : "appointment");
        return `Hello! 😊 This week only — ₹${amount} off for the first ${count} ${svc} bookings${expiry ? ` (till ${expiry})` : ""}. Pick your slot: ${link}`;
      },
      rebook_post: () => {
        const svc = topService || (isDentist ? "cleaning / consultation" : "slots");
        return `Hi! Loved having you last time. This week’s ${svc} are filling fast — pick a convenient time: ${link}`;
      },
      thankyou_post: () => {
        const svc = topService || (isDentist ? "dental care" : "service");
        return `Thank you for choosing us! 🙏 If this ${svc} helped, please share with a friend. To rebook, use this link: ${link}`;
      },
      new_patient: () => {
        const svc = topService || (isDentist ? "first dental visit" : "first appointment");
        return `New here? Welcome! 🎉 Book your ${svc} and get a special ₹150 welcome credit. Choose your time: ${link}`;
      },
      no_show: () => {
        const svc = topService || (isDentist ? "dental appointment" : "appointment");
        return `We missed you last time. It happens! 😊 Rebook your ${svc} quickly here — we’ll hold a priority slot for you: ${link}`;
      },
    };

    const hi = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        const svc = topService || (isDentist ? "dental checkup" : "appointment");
        return `Hello! 😊 Sirf is week — pehli ${count} ${svc} bookings par ₹${amount} off${expiry ? ` (till ${expiry})` : ""}. Slot yahan choose karein: ${link}`;
      },
      rebook_post: () => {
        const svc = topService || (isDentist ? "cleaning/consultation" : "slots");
        return `Hi! Pichhli baar aap aaye the, bahut accha laga. Is week ke ${svc} fast fill ho rahe hain — apna time choose karein: ${link}`;
      },
      thankyou_post: () => {
        const svc = topService || (isDentist ? "dental care" : "service");
        return `Thank you! 🙏 Agar yeh ${svc} helpful raha ho to ek dost ke saath share karein. Rebook ke liye yeh link use karein: ${link}`;
      },
      new_patient: () => {
        const svc = topService || (isDentist ? "pehli dental visit" : "first appointment");
        return `Naye hain? Swagat hai! 🎉 ${svc} par ₹150 welcome credit. Time choose karein: ${link}`;
      },
      no_show: () => {
        const svc = topService || (isDentist ? "dental appointment" : "appointment");
        return `Pichhli baar miss ho gaya — koi baat nahi! 😊 Apni ${svc} jaldi se rebook karein, hum priority slot hold karenge: ${link}`;
      },
    };

    return { en, hi };
  }, [lang, isDentist, topService, link]);

  // Template list + per-card local state (placeholders + media)
  const [state, setState] = useState<Record<string, any>>({
    "tpl-offer":      { amount: 200, count: 10, expiry: defaultISTDateTimeLocal(24 * 60).slice(0, 10), media: "" },
    "tpl-rebook":     { media: "" },
    "tpl-thanks":     { media: "" },
    "tpl-newpatient": { media: "" },
    "tpl-noshow":     { media: "" },
  });

  function defaultISTDateTimeLocal(minutesFromNow = 60) {
    const now = new Date();
    const istOffsetMin = 330;
    const t = new Date(now.getTime() + (istOffsetMin * 60 + minutesFromNow) * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = t.getUTCFullYear();
    const m = pad(t.getUTCMonth() + 1);
    const d = pad(t.getUTCDate());
    const hh = pad(t.getUTCHours());
    const mm = pad(t.getUTCMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  const templates = useMemo(() => {
    const items: Array<{id: string; kind: TemplateKind; title: string; blurb: string; computeText: () => string}> = [
      {
        id: "tpl-offer",
        kind: "offer",
        title: isDentist ? "Limited-time Dental Offer" : "Limited-time Offer",
        blurb: isDentist ? "Fill this week’s dental slots (checkups/cleaning)." : "Simple discount to fill this week’s slots.",
        computeText: () => {
          const s = state["tpl-offer"] || {};
          const fn = (lang === "en" ? baseText.en.offer : baseText.hi.offer);
          return fn(Number(s.amount || 200), Number(s.count || 10), s.expiry ? new Date(s.expiry).toISOString() : undefined);
        },
      },
      {
        id: "tpl-rebook",
        kind: "rebook_post",
        title: isDentist ? "Rebook: Cleaning / Consultation" : "Rebooking Nudge",
        blurb: isDentist ? "Win back patients for cleaning/review." : "Win back past leads with a polite nudge.",
        computeText: () => (lang === "en" ? baseText.en.rebook_post() : baseText.hi.rebook_post()),
      },
      {
        id: "tpl-thanks",
        kind: "thankyou_post",
        title: isDentist ? "Thank You + Refer a Friend" : "Thank You + Share",
        blurb: isDentist ? "Post-visit thanks; ask to refer for checkups." : "Post-visit thank-you + gentle share ask.",
        computeText: () => (lang === "en" ? baseText.en.thankyou_post() : baseText.hi.thankyou_post()),
      },
      {
        id: "tpl-newpatient",
        kind: "new_patient",
        title: isDentist ? "Welcome New Patient" : "New Patient Welcome",
        blurb: isDentist ? "Cold-start for first dental visit." : "Cold-start for first-time visitors.",
        computeText: () => (lang === "en" ? baseText.en.new_patient() : baseText.hi.new_patient()),
      },
      {
        id: "tpl-noshow",
        kind: "no_show",
        title: isDentist ? "Missed Appointment → Rebook" : "No-Show Recovery",
        blurb: isDentist ? "Turn a miss into a rebooking (dental)." : "Turn a miss into a rebooking.",
        computeText: () => (lang === "en" ? baseText.en.no_show() : baseText.hi.no_show()),
      },
    ];
    return items;
  }, [baseText, lang, state, isDentist]);

  // Fetch analytics (7d) and compute per-kind sent/open proxy
  useEffect(() => {
    let on = true;
    (async () => {
      const rows = await fetchRecentEvents();
      const sent: Record<string, number> = {};
      const opens: Record<string, number> = {};
      for (const r of rows) {
        if (!within7d(Number(r.ts))) continue;
        if (r.event === "template.sent") {
          const k = r?.source?.kind || "unknown";
          sent[k] = (sent[k] || 0) + 1;
        }
        if (r.event === "booking.landing.opened" && (r?.source?.campaign === "template-pack" || r?.source?.utm_source === "whatsapp")) {
          opens["total"] = (opens["total"] || 0) + 1;
        }
      }
      const merged: Record<string, { sent7d: number; opens7d: number }> = {};
      for (const t of templates) {
        merged[t.kind] = { sent7d: sent[t.kind] || 0, opens7d: opens["total"] || 0 };
      }
      if (on) setAnalytics(merged);
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, aud, isDentist]); // include TG

  return (
    <div>
      {/* (Language & Audience chips unchanged) */}
      {/* ... keep existing LangToggle & AudienceChips here ... */}

      {/* The rest of the component rendering stays identical to current,
          using 'templates' above which is now TG-aware. */}
      {/* For brevity, your existing card rendering code continues unchanged
          — just replace the top half of this file with this new version. */}
    </div>
  );
}
