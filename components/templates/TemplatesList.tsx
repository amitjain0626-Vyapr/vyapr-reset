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
  try { const sp = new URLSearchParams(window.location.search); const s = sp.get("slug"); if (s) return s.trim(); } catch {}
  return "";
}
async function resolveProviderIdFromEvents(): Promise<string | null> {
  try {
    const res = await fetch(`/api/debug/events?limit=50`, { cache: "no-store" });
    const j = await res.json();
    if (Array.isArray(j?.rows)) for (const r of j.rows) if (r?.provider_id) return r.provider_id;
  } catch {}
  return null;
}
function redirectUrl(event: string, kind: TemplateKind, slug: string, pid: string | null, text: string, audience: Audience, mediaUrl?: string | null) {
  const p = new URLSearchParams();
  p.set("e", event);
  p.set("kind", kind);
  if (slug) p.set("slug", slug);
  if (pid) p.set("pid", pid);
  p.set("aud", audience);
  if (mediaUrl) p.set("media", mediaUrl);
  p.set("text", text);
  return `/api/events/redirect?${p.toString()}`;
}
async function fetchRecentEvents(): Promise<any[]> {
  try { const r = await fetch(`/api/debug/events?limit=200`, { cache: "no-store" }); const j = await r.json(); return Array.isArray(j?.rows) ? j.rows : []; }
  catch { return []; }
}
function within7d(tsMs: number) {
  const now = Date.now();
  return now - Number(tsMs) <= 7 * 24 * 60 * 60 * 1000;
}

// ---- NEW: Provider meta → TG-aware copy ----
type ProviderMeta = { provider?: { id?: string; slug?: string; display_name?: string; category?: string; location?: string } | null; services?: Array<{ name: string }>; };
async function fetchProviderMeta(slug: string): Promise<ProviderMeta> {
  if (!slug) return {};
  try { const r = await fetch(`${SITE}/api/providers/meta?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }); return (await r.json()) || {}; }
  catch { return {}; }
}
const norm = (s?: string) => (s || "").toLowerCase();

// Detect dental procedure focus from service names
function detectDentalFocus(services: Array<{name: string}> = []) {
  const names = services.map(s => s.name.toLowerCase());
  if (names.some(n => /scal(ing)?|polish/i.test(n))) return "scaling & polishing";
  if (names.some(n => /\brct\b|root\s*canal/i.test(n))) return "RCT consult";
  if (names.some(n => /brace|orthodontic/i.test(n))) return "braces consult";
  if (names.some(n => /whiten(ing)?|bleach/i.test(n))) return "teeth whitening";
  return "";
}

// Maps category → default service terms (TG1/TG2 starter set)
const TG_TERMS: Record<string, { top?: string; offer?: string; rebook?: string; thanks?: string; newp?: string; noshow?: string }> = {
  // TG1 medical
  "dentist":         { top: "dental checkup", offer: "scaling & polishing", rebook: "cleaning / consultation", thanks: "dental care", newp: "first dental visit", noshow: "dental appointment" },
  "dental":          { top: "dental checkup", offer: "scaling & polishing", rebook: "cleaning / consultation", thanks: "dental care", newp: "first dental visit", noshow: "dental appointment" },
  "physiotherapist": { top: "physio session", offer: "assessment",          rebook: "follow-up session",        thanks: "physio care",   newp: "first physio",     noshow: "physio session" },
  "physio":          { top: "physio session", offer: "assessment",          rebook: "follow-up session",        thanks: "physio care",   newp: "first physio",     noshow: "physio session" },
  "dermatologist":   { top: "skin consult",   offer: "consult",             rebook: "review consult",           thanks: "derma care",    newp: "first consult",    noshow: "derma consult" },
  "skin clinic":     { top: "skin consult",   offer: "consult",             rebook: "review consult",           thanks: "derma care",    newp: "first consult",    noshow: "derma consult" },
  "gynecologist":    { top: "gyn consult",    offer: "consult",             rebook: "follow-up consult",        thanks: "care visit",    newp: "first consult",    noshow: "consult" },
  "pediatrician":    { top: "child consult",  offer: "consult",             rebook: "review consult",           thanks: "child care",    newp: "first consult",    noshow: "consult" },

  // TG1 beauty/fitness
  "salon":           { top: "haircut",        offer: "cut/style",           rebook: "trim/style",               thanks: "salon service", newp: "first visit",      noshow: "salon appointment" },
  "spa":             { top: "spa session",    offer: "relax session",       rebook: "follow-up session",        thanks: "spa care",      newp: "first session",    noshow: "session" },
  "gym trainer":     { top: "personal session", offer: "trial session",     rebook: "PT session",               thanks: "fitness plan",  newp: "intro session",    noshow: "training session" },
  "yoga":            { top: "yoga class",     offer: "trial class",         rebook: "class",                    thanks: "yoga session",  newp: "intro class",      noshow: "yoga class" },

  // TG2 home/local services
  "tutor":           { top: "demo class",     offer: "intro class",         rebook: "class",                    thanks: "coaching",      newp: "first class",      noshow: "class" },
  "plumber":         { top: "plumbing visit", offer: "home visit",          rebook: "service visit",            thanks: "repair",        newp: "first visit",      noshow: "service visit" },
  "electrician":     { top: "electric visit", offer: "home visit",          rebook: "service visit",            thanks: "repair",        newp: "first visit",      noshow: "service visit" },
  "photographer":    { top: "shoot",          offer: "mini shoot",          rebook: "edit/re-shoot",            thanks: "shoot",         newp: "intro shoot",      noshow: "shoot" },
  "cleaning":        { top: "deep clean",     offer: "home clean",          rebook: "follow-up clean",          thanks: "service",       newp: "first clean",      noshow: "service" },
};

export default function TemplatesList({ slug }: { slug?: string }) {
  const [origin] = useState<string>(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const [providerId, setProviderId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(() => { try { return (localStorage.getItem("vyapr.lang") as Lang) || "en"; } catch {} return "en"; });
  const [aud, setAud] = useState<Audience>(() => { try { return (localStorage.getItem("vyapr.audience") as Audience) || "all"; } catch {} return "all"; });
  const [analytics, setAnalytics] = useState<Record<string, { sent7d: number; opens7d: number }>>({});
  const effectiveSlug = readSlugFallback(slug);

  // NEW: Pull provider meta (category + services)
  const [meta, setMeta] = useState<ProviderMeta>({});
  useEffect(() => {
    let on = true;
    (async () => { const m = await fetchProviderMeta(effectiveSlug); if (on) setMeta(m || {}); })();
    return () => { on = false; };
  }, [effectiveSlug]);

  const category = norm(meta?.provider?.category);
  const svcTop = meta?.services?.[0]?.name || "";
  const tg = TG_TERMS[category || ""] || undefined;

  // Dental procedure override (if provider is dental)
  const dentalSpecific = /dent(ist|al)/i.test(category || "") ? detectDentalFocus(meta?.services || []) : "";

  // providerId
  useEffect(() => {
    let on = true;
    (async () => { const id = await resolveProviderIdFromEvents(); if (on) setProviderId(id); })();
    return () => { on = false; };
  }, []);

  // prefs
  useEffect(() => { try { localStorage.setItem("vyapr.lang", lang); } catch {} }, [lang]);
  useEffect(() => { try { localStorage.setItem("vyapr.audience", aud); } catch {} }, [aud]);

  const link = buildBookingLink(origin, effectiveSlug || "");

  // TG-aware text dictionaries (EN+HI) with dental procedure preference
  const baseText = useMemo(() => {
    // choose service terms
    const svcOffer = (dentalSpecific || tg?.offer || svcTop || "appointment");
    const svcRebook = (dentalSpecific || tg?.rebook || svcTop || "slots");
    const svcThanks = (dentalSpecific || tg?.thanks || svcTop || "service");
    const svcNew    = (dentalSpecific || tg?.newp  || svcTop || "first appointment");
    const svcNo     = (dentalSpecific || tg?.noshow|| svcTop || "appointment");

    const en = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        return `Hello! 😊 This week only — ₹${amount} off for the first ${count} ${svcOffer} bookings${expiry ? ` (till ${expiry})` : ""}. Pick your slot: ${link}`;
      },
      rebook_post: () => `Hi! Loved having you last time. This week’s ${svcRebook} are filling fast — pick a convenient time: ${link}`,
      thankyou_post: () => `Thank you for choosing us! 🙏 If this ${svcThanks} helped, please share with a friend. To rebook, use this link: ${link}`,
      new_patient: () => `New here? Welcome! 🎉 Book your ${svcNew} and get a special ₹150 welcome credit. Choose your time: ${link}`,
      no_show: () => `We missed you last time. It happens! 😊 Rebook your ${svcNo} quickly here — we’ll hold a priority slot for you: ${link}`,
    };

    const hi = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        return `Hello! 😊 Sirf is week — pehli ${count} ${svcOffer} bookings par ₹${amount} off${expiry ? ` (till ${expiry})` : ""}. Slot yahan choose karein: ${link}`;
      },
      rebook_post: () => `Hi! Pichhli baar aap aaye the, bahut accha laga. Is week ke ${svcRebook} fast fill ho rahe hain — apna time choose karein: ${link}`,
      thankyou_post: () => `Thank you! 🙏 Agar yeh ${svcThanks} helpful raha ho to ek dost ke saath share karein. Rebook ke liye yeh link use karein: ${link}`,
      new_patient: () => `Naye hain? Swagat hai! 🎉 ${svcNew} par ₹150 welcome credit. Time choose karein: ${link}`,
      no_show: () => `Pichhli baar miss ho gaya — koi baat nahi! 😊 Apni ${svcNo} jaldi se rebook karein, hum priority slot hold karenge: ${link}`,
    };

    return { en, hi };
  }, [link, svcTop, category, dentalSpecific]);

  // UI state (placeholders + media)
  function defaultISTDateTimeLocal(minutesFromNow = 60) {
    const now = new Date(); const istOffsetMin = 330;
    const t = new Date(now.getTime() + (istOffsetMin * 60 + minutesFromNow) * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  }
  const [state, setState] = useState<Record<string, any>>({
    "tpl-offer":      { amount: 200, count: 10, expiry: defaultISTDateTimeLocal(24 * 60).slice(0, 10), media: "" },
    "tpl-rebook":     { media: "" },
    "tpl-thanks":     { media: "" },
    "tpl-newpatient": { media: "" },
    "tpl-noshow":     { media: "" },
  });

  // Templates (TG-aware titles/blurbs)
  const templates = useMemo(() => {
    const isDental = /dent(ist|al)/i.test(category || "");
    const items: Array<{id: string; kind: TemplateKind; title: string; blurb: string; computeText: () => string}> = [
      {
        id: "tpl-offer",
        kind: "offer",
        title: isDental ? "Limited-time Dental Offer" : "Limited-time Offer",
        blurb: isDental ? "Fill this week’s dental slots (checkups/cleaning/RCT consult)." : "Simple discount to fill this week’s slots.",
        computeText: () => {
          const s = state["tpl-offer"] || {};
          const fn = (lang === "en" ? baseText.en.offer : baseText.hi.offer);
          return fn(Number(s.amount || 200), Number(s.count || 10), s.expiry ? new Date(s.expiry).toISOString() : undefined);
        },
      },
      {
        id: "tpl-rebook",
        kind: "rebook_post",
        title: isDental ? "Rebook: Cleaning / Consultation" : "Rebooking Nudge",
        blurb: isDental ? "Win back patients for cleaning / braces / RCT reviews." : "Win back past leads with a polite nudge.",
        computeText: () => (lang === "en" ? baseText.en.rebook_post() : baseText.hi.rebook_post()),
      },
      {
        id: "tpl-thanks",
        kind: "thankyou_post",
        title: isDental ? "Thank You + Refer a Friend" : "Thank You + Share",
        blurb: isDental ? "Post-visit thanks; ask to refer for checkups." : "Post-visit thank-you + gentle share ask.",
        computeText: () => (lang === "en" ? baseText.en.thankyou_post() : baseText.hi.thankyou_post()),
      },
      {
        id: "tpl-newpatient",
        kind: "new_patient",
        title: isDental ? "Welcome New Patient" : "New Patient Welcome",
        blurb: isDental ? "Cold-start for first dental visit." : "Cold-start for first-time visitors.",
        computeText: () => (lang === "en" ? baseText.en.new_patient() : baseText.hi.new_patient()),
      },
      {
        id: "tpl-noshow",
        kind: "no_show",
        title: isDental ? "Missed Appointment → Rebook" : "No-Show Recovery",
        blurb: isDental ? "Turn a miss into a rebooking (dental)." : "Turn a miss into a rebooking.",
        computeText: () => (lang === "en" ? baseText.en.no_show() : baseText.hi.no_show()),
      },
    ];
    return items;
  }, [baseText, lang, state, category]);

  // 7-day analytics (unchanged)
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
      for (const t of templates) merged[t.kind] = { sent7d: sent[t.kind] || 0, opens7d: opens["total"] || 0 };
      if (on) setAnalytics(merged);
    })();
    return () => { on = false; };
  }, [lang, aud, templates]);

  // UI helpers
  function Btn({ children, className = "", ...rest }: any) {
    return <button className={`inline-flex items-center rounded-full border px-3 py-2 text-sm hover:shadow-sm ${className}`} {...rest}>{children}</button>;
  }

  return (
    <div>
      {/* Language & Audience */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-600">Language:</span>
        <Btn className={lang==="en"?"bg-black text-white":""} onClick={()=>setLang("en")}>English</Btn>
        <Btn className={lang==="hi"?"bg-black text-white":""} onClick={()=>setLang("hi")}>Hinglish</Btn>
        <span className="ml-4 text-sm text-gray-600">Audience:</span>
        <Btn className={aud==="all"?"bg-black text-white":""} onClick={()=>setAud("all")}>All</Btn>
        <Btn className={aud==="new"?"bg-black text-white":""} onClick={()=>setAud("new")}>New</Btn>
        <Btn className={aud==="repeat"?"bg-black text-white":""} onClick={()=>setAud("repeat")}>Repeat</Btn>
      </div>

      {/* Template cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => {
          const s = state[t.id] || {};
          const base = t.computeText();
          const finalText = s.media ? `${base}\n\nImage: ${s.media}` : base;

          const go = redirectUrl("template.sent", t.kind, effectiveSlug, providerId, finalText, aud, s.media || "");
          const a = analytics[t.kind] || { sent7d: 0, opens7d: 0 };

          return (
            <article key={t.id} className="rounded-2xl border p-4 bg-white">
              <h3 className="font-semibold text-lg">{t.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{t.blurb}</p>

              {/* Offer placeholders */}
              {t.kind === "offer" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-gray-600">₹ Amount</label>
                    <input type="number" className="w-full border rounded-lg p-2 text-sm"
                      value={s.amount ?? 200}
                      onChange={(e)=>setState(p=>({...p,[t.id]:{...s,amount:Number(e.target.value||0)}}))}
                    />
                  </div>
                  <div><label className="text-xs text-gray-600">Count</label>
                    <input type="number" className="w-full border rounded-lg p-2 text-sm"
                      value={s.count ?? 10}
                      onChange={(e)=>setState(p=>({...p,[t.id]:{...s,count:Number(e.target.value||0)}}))}
                    />
                  </div>
                  <div><label className="text-xs text-gray-600">Expiry</label>
                    <input type="date" className="w-full border rounded-lg p-2 text-sm"
                      value={s.expiry}
                      onChange={(e)=>setState(p=>({...p,[t.id]:{...s,expiry:e.target.value}}))}
                    />
                  </div>
                </div>
              )}

              {/* Media URL */}
              <div className="mt-3">
                <label className="text-xs text-gray-600">Image URL (optional)</label>
                <input type="url" placeholder="https://…" className="mt-1 w-full border rounded-lg p-2 text-sm"
                  value={s.media || ""}
                  onChange={(e)=>setState(p=>({...p,[t.id]:{...s,media:e.target.value.trim()}}))}
                />
              </div>

              {/* Preview */}
              <textarea readOnly className="mt-3 w-full h-36 text-sm border rounded-xl p-3 bg-gray-50" value={finalText} />

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a className="inline-flex items-center rounded-full border px-3 py-2 text-sm hover:shadow-sm bg-black text-white"
                   href={go} target="_blank" rel="noopener noreferrer">
                  Send on WhatsApp
                </a>
                <Btn onClick={async ()=>{
                  try { await navigator.clipboard.writeText(finalText); } catch {}
                  const url = redirectUrl("template.copied", t.kind, effectiveSlug, providerId, finalText, aud, s.media || "");
                  fetch(url + "&debug=0", { method: "GET", keepalive: true });
                  alert("Copied to clipboard ✓");
                }}>Copy</Btn>
                <Btn onClick={async ()=>{
                  const when = prompt("Schedule when? (ISO or 'YYYY-MM-DD')", new Date().toISOString().slice(0,10));
                  if (!when) return;
                  try {
                    await fetch("/api/events/log", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        event: "template.schedule.requested",
                        ts: Date.now(),
                        provider_id: providerId,
                        lead_id: null,
                        source: { via: "ui", kind: t.kind, provider_slug: effectiveSlug || null, whenISO: new Date(when).toISOString(), audience: aud, media_url: s.media || null },
                      }),
                    });
                    alert("Scheduled request logged ✓");
                  } catch { alert("Could not log schedule, please try again."); }
                }}>Schedule for later</Btn>
              </div>

              {/* Mini analytics */}
              <div className="mt-3 text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border px-2 py-1 bg-white">7d Sends: <b>{a.sent7d}</b></span>
                  <span className="rounded-lg border px-2 py-1 bg-white">7d Opens (proxy): <b>{a.opens7d}</b></span>
                </div>
                {!providerId && (<p className="mt-2 text-amber-700">Resolving provider… first click may not log; try again once resolved.</p>)}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
