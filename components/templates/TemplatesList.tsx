// components/templates/TemplatesList.tsx
"use client";
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

type TemplateKind = "offer" | "rebook_post" | "thankyou_post" | "new_patient" | "no_show";
type Lang = "en" | "hi";
type Audience = "all" | "new" | "repeat";

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

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-sm text-gray-600">Language:</span>
      <button className={`btn ${lang === "en" ? "bg-black text-white" : ""}`} onClick={() => setLang("en")}>
        English
      </button>
      <button className={`btn ${lang === "hi" ? "bg-black text-white" : ""}`} onClick={() => setLang("hi")}>
        Hinglish
      </button>
    </div>
  );
}

function AudienceChips({ aud, setAud }: { aud: Audience; setAud: (a: Audience) => void }) {
  const Chip = ({ v, label }: { v: Audience; label: string }) => (
    <button
      className={`btn ${aud === v ? "bg-black text-white" : ""}`}
      onClick={() => setAud(v)}
      aria-pressed={aud === v}
    >
      {label}
    </button>
  );
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-sm text-gray-600">Audience:</span>
      <Chip v="all" label="All" />
      <Chip v="new" label="New" />
      <Chip v="repeat" label="Repeat" />
    </div>
  );
}

function defaultISTDateTimeLocal(minutesFromNow = 60) {
  // Build a datetime-local string (yyyy-MM-ddThh:mm) using IST
  const now = new Date();
  const istOffsetMin = 330; // IST UTC+5:30
  const t = new Date(now.getTime() + (istOffsetMin * 60 + minutesFromNow) * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = t.getUTCFullYear();
  const m = pad(t.getUTCMonth() + 1);
  const d = pad(t.getUTCDate());
  const hh = pad(t.getUTCHours());
  const mm = pad(t.getUTCMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
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
  useEffect(() => {
    try { localStorage.setItem("vyapr.lang", lang); } catch {}
  }, [lang]);
  useEffect(() => {
    try { localStorage.setItem("vyapr.audience", aud); } catch {}
  }, [aud]);

  // Prepare base text dictionaries (with placeholders)
  const baseText = useMemo(() => {
    const link = buildBookingLink(origin, effectiveSlug || "");

    const en = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        return `Hello! 😊 This week only — ₹${amount} off for the first ${count} bookings${expiry ? ` (till ${expiry})` : ""}. Pick your slot here: ${link}`;
      },
      rebook_post: () => `Hi! Loved having you last time. This week’s slots are filling fast — pick a convenient time: ${link}`,
      thankyou_post: () => `Thank you for choosing us! 🙏 If you found this helpful, please share with a friend. To rebook, use this link: ${link}`,
      new_patient: () => `New here? Welcome! 🎉 Book your first appointment and get a special ₹150 welcome credit. Choose your time: ${link}`,
      no_show: () => `We missed you last time. It happens! 😊 Rebook quickly here — we’ll hold a priority slot for you: ${link}`,
    };

    const hi = {
      offer: (amount = 200, count = 10, expiryISO?: string) => {
        const expiry = expiryISO ? new Date(expiryISO).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined;
        return `Hello! 😊 Sirf is week — pehli ${count} bookings par ₹${amount} off${expiry ? ` (till ${expiry})` : ""}. Slot yahan choose karein: ${link}`;
      },
      rebook_post: () => `Hi! Pichhli baar aap aaye the, bahut accha laga. Is week ke slots fast fill ho rahe hain — apna time choose karein: ${link}`,
      thankyou_post: () => `Thank you! 🙏 Agar experience accha laga ho to ek dost ke saath share karein. Rebook ke liye yeh link use karein: ${link}`,
      new_patient: () => `Naye hain? Swagat hai! 🎉 Pehli appointment par ₹150 welcome credit. Time choose karein: ${link}`,
      no_show: () => `Pichhli baar miss ho gaya — koi baat nahi! 😊 Yahan se jaldi rebook karein, hum aapke liye priority slot hold karenge: ${link}`,
    };

    return { en, hi };
  }, [origin, effectiveSlug]);

  // Template list + per-card local state (placeholders + media)
  const [state, setState] = useState<Record<string, any>>({
    "tpl-offer":      { amount: 200, count: 10, expiry: defaultISTDateTimeLocal(24 * 60).slice(0, 10), media: "" },
    "tpl-rebook":     { media: "" },
    "tpl-thanks":     { media: "" },
    "tpl-newpatient": { media: "" },
    "tpl-noshow":     { media: "" },
  });

  const templates = useMemo(() => {
    const items: Array<{id: string; kind: TemplateKind; title: string; blurb: string; computeText: () => string}> = [
      {
        id: "tpl-offer",
        kind: "offer",
        title: "Limited-time Offer",
        blurb: "Simple discount to fill this week’s slots.",
        computeText: () => {
          const s = state["tpl-offer"] || {};
          const fn = (lang === "en" ? baseText.en.offer : baseText.hi.offer);
          return fn(Number(s.amount || 200), Number(s.count || 10), s.expiry ? new Date(s.expiry).toISOString() : undefined);
        },
      },
      {
        id: "tpl-rebook",
        kind: "rebook_post",
        title: "Rebooking Nudge",
        blurb: "Win back past leads with a polite nudge.",
        computeText: () => (lang === "en" ? baseText.en.rebook_post() : baseText.hi.rebook_post()),
      },
      {
        id: "tpl-thanks",
        kind: "thankyou_post",
        title: "Thank You + Share",
        blurb: "Post-visit thank-you + gentle share ask.",
        computeText: () => (lang === "en" ? baseText.en.thankyou_post() : baseText.hi.thankyou_post()),
      },
      {
        id: "tpl-newpatient",
        kind: "new_patient",
        title: "New Patient Welcome",
        blurb: "Cold-start for first-time visitors.",
        computeText: () => (lang === "en" ? baseText.en.new_patient() : baseText.hi.new_patient()),
      },
      {
        id: "tpl-noshow",
        kind: "no_show",
        title: "No-Show Recovery",
        blurb: "Turn a miss into a rebooking.",
        computeText: () => (lang === "en" ? baseText.en.no_show() : baseText.hi.no_show()),
      },
    ];
    return items;
  }, [baseText, lang, state]);

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
          // proxy for clicks/opens from messages
          opens["total"] = (opens["total"] || 0) + 1;
        }
      }
      const merged: Record<string, { sent7d: number; opens7d: number }> = {};
      for (const t of templates) {
        merged[t.kind] = {
          sent7d: sent[t.kind] || 0,
          opens7d: opens["total"] || 0, // simple proxy shared across
        };
      }
      if (on) setAnalytics(merged);
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, aud]); // re-run when UI context changes (cheap enough)

  return (
    <div>
      <LangToggle lang={lang} setLang={setLang} />
      <AudienceChips aud={aud} setAud={setAud} />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => {
          const s = state[t.id] || {};
          // Compose final text with optional media URL appended (as many WA clients just treat it as a link)
          const base = t.computeText();
          const finalText = s.media ? `${base}\n\nImage: ${s.media}` : base;

          const go = redirectUrl("template.sent", t.kind, effectiveSlug, providerId, finalText, aud, s.media || "");

          const a = analytics[t.kind] || { sent7d: 0, opens7d: 0 };

          return (
            <article key={t.id} className="card p-4">
              <h3 className="font-semibold text-lg">{t.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{t.blurb}</p>

              {/* Inline placeholders */}
              {t.kind === "offer" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">₹ Amount</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={s.amount ?? 200}
                      onChange={(e) => setState((prev) => ({ ...prev, [t.id]: { ...s, amount: Number(e.target.value || 0) } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Count</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={s.count ?? 10}
                      onChange={(e) => setState((prev) => ({ ...prev, [t.id]: { ...s, count: Number(e.target.value || 0) } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Expiry</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={s.expiry || defaultISTDateTimeLocal(24 * 60).slice(0, 10)}
                      onChange={(e) => setState((prev) => ({ ...prev, [t.id]: { ...s, expiry: e.target.value } }))}
                    />
                  </div>
                </div>
              )}

              {/* Media URL (optional) */}
              <div className="mt-3">
                <label className="text-xs text-gray-600">Image URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://…"
                  className="mt-1 w-full border rounded-lg p-2 text-sm"
                  value={s.media || ""}
                  onChange={(e) => setState((prev) => ({ ...prev, [t.id]: { ...s, media: e.target.value.trim() } }))}
                />
              </div>

              {/* Preview text */}
              <textarea
                readOnly
                className="mt-3 w-full h-36 text-sm border rounded-xl p-3 bg-gray-50"
                value={finalText}
              />

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a className="btn-primary" href={go} target="_blank" rel="noopener noreferrer">
                  Send on WhatsApp
                </a>
                <button
                  className="btn"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(finalText); } catch {}
                    // Fire a copy log (via redirect endpoint so it tags audience/media)
                    const url = redirectUrl("template.copied", t.kind, effectiveSlug, providerId, finalText, aud, s.media || "");
                    fetch(url + "&debug=0", { method: "GET", keepalive: true });
                    alert("Copied to clipboard ✓");
                  }}
                >
                  Copy
                </button>
                {/* minimal “Schedule for later” stays (logged via /api/events/log directly) */}
                <button
                  className="btn"
                  onClick={async () => {
                    const when = prompt("Schedule when? (ISO or 'YYYY-MM-DDTHH:mm')", defaultISTDateTimeLocal(60));
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
                    } catch {
                      alert("Could not log schedule, please try again.");
                    }
                  }}
                >
                  Schedule for later
                </button>
              </div>

              {/* Mini analytics */}
              <div className="mt-3 text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border px-2 py-1 bg-white">7d Sends: <b>{a.sent7d}</b></span>
                  <span className="rounded-lg border px-2 py-1 bg-white">7d Opens (proxy): <b>{a.opens7d}</b></span>
                </div>
                {!providerId && (
                  <p className="mt-2 text-amber-700">
                    Resolving provider… first click may not log; try again once resolved.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
