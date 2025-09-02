// components/templates/TemplatesList.tsx
"use client";
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

type TemplateKind = "offer" | "rebook_post" | "thankyou_post" | "new_patient" | "no_show";
type Lang = "en" | "hi";

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
    const res = await fetch(`/api/debug/events?limit=20`, { cache: "no-store" });
    const j = await res.json();
    if (j?.rows && Array.isArray(j.rows)) {
      for (const r of j.rows) {
        if (r?.provider_id) return r.provider_id;
      }
    }
  } catch {}
  return null;
}

function redirectUrl(event: string, kind: TemplateKind, slug: string, pid: string | null, text: string) {
  const params = new URLSearchParams();
  params.set("e", event);
  params.set("kind", kind);
  if (slug) params.set("slug", slug);
  if (pid) params.set("pid", pid);
  params.set("text", text);
  return `/api/events/redirect?${params.toString()}`;
}

async function logEvent(payload: any) {
  try {
    const res = await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
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

// Small inline scheduler UI per card
function Scheduler({
  onClose,
  onConfirm,
  defaultISO,
}: {
  onClose: () => void;
  onConfirm: (iso: string) => void;
  defaultISO: string;
}) {
  const [v, setV] = useState(defaultISO);
  return (
    <div className="mt-2 p-3 border rounded-xl bg-gray-50">
      <label className="text-xs text-gray-600">Pick date & time (IST)</label>
      <input
        type="datetime-local"
        className="mt-1 w-full text-sm border rounded-lg p-2 bg-white"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          onClick={() => {
            if (!v) return;
            // Normalize to ISO (assumes v is local IST on user device)
            try {
              const iso = new Date(v).toISOString();
              onConfirm(iso);
            } catch {
              onConfirm(new Date().toISOString());
            }
          }}
        >
          Schedule
        </button>
      </div>
    </div>
  );
}

function defaultISTDateTimeLocal(minutesFromNow = 60) {
  // Build a datetime-local string (yyyy-MM-ddThh:mm) using IST
  const now = new Date();
  const istOffsetMin = 330; // IST UTC+5:30
  const utcMin = now.getUTCMinutes() + now.getUTCHours() * 60 + now.getUTCDate() * 24 * 60;
  const istNow = new Date(now.getTime() + istOffsetMin * 60 * 1000);
  const t = new Date(istNow.getTime() + minutesFromNow * 60 * 1000);
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
  const [openFor, setOpenFor] = useState<string | null>(null); // card id for scheduler
  const effectiveSlug = readSlugFallback(slug);

  useEffect(() => {
    let on = true;
    (async () => {
      const id = await resolveProviderIdFromEvents();
      if (on) setProviderId(id);
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("vyapr.lang", lang); } catch {}
  }, [lang]);

  const texts = useMemo(() => {
    const link = buildBookingLink(origin, effectiveSlug || "");

    const en = {
      offer: `Hello! 😊 This week only — ₹200 off for the first 10 bookings. Pick your slot here: ${link}`,
      rebook_post: `Hi! Loved having you last time. This week’s slots are filling fast — pick a convenient time: ${link}`,
      thankyou_post: `Thank you for choosing us! 🙏 If you found this helpful, please share with a friend. To rebook, use this link: ${link}`,
      new_patient: `New here? Welcome! 🎉 Book your first appointment and get a special ₹150 welcome credit. Choose your time: ${link}`,
      no_show: `We missed you last time. It happens! 😊 Rebook quickly here — we’ll hold a priority slot for you: ${link}`,
    };

    const hi = {
      offer: `Hello! 😊 Sirf is week — pehli 10 bookings par ₹200 off. Slot yahan choose karein: ${link}`,
      rebook_post: `Hi! Pichhli baar aap aaye the, bahut accha laga. Is week ke slots fast fill ho rahe hain — apna time choose karein: ${link}`,
      thankyou_post: `Thank you! 🙏 Agar experience accha laga ho to ek dost ke saath share karein. Rebook ke liye yeh link use karein: ${link}`,
      new_patient: `Naye hain? Swagat hai! 🎉 Pehli appointment par ₹150 welcome credit. Time choose karein: ${link}`,
      no_show: `Pichhli baar miss ho gaya — koi baat nahi! 😊 Yahan se jaldi rebook karein, hum aapke liye priority slot hold karenge: ${link}`,
    };

    return lang === "en" ? en : hi;
  }, [origin, effectiveSlug, lang]);

  const templates = useMemo(() => {
    const items: Array<{id: string; kind: TemplateKind; title: string; blurb: string; text: string}> = [
      { id: "tpl-offer",        kind: "offer",        title: "Limited-time Offer",    blurb: "Simple discount to fill this week’s slots.", text: texts.offer },
      { id: "tpl-rebook",       kind: "rebook_post",  title: "Rebooking Nudge",       blurb: "Win back past leads with a polite nudge.",  text: texts.rebook_post },
      { id: "tpl-thanks",       kind: "thankyou_post",title: "Thank You + Share",     blurb: "Post-visit thank-you + gentle share ask.",   text: texts.thankyou_post },
      { id: "tpl-newpatient",   kind: "new_patient",  title: "New Patient Welcome",   blurb: "Cold-start for first-time visitors.",        text: texts.new_patient },
      { id: "tpl-noshow",       kind: "no_show",      title: "No-Show Recovery",      blurb: "Turn a miss into a rebooking.",              text: texts.no_show },
    ];
    return items;
  }, [texts]);

  return (
    <div>
      <LanguageToggle lang={lang} setLang={setLang} />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => {
          const go = redirectUrl("template.sent", t.kind, effectiveSlug, providerId, t.text);
          const datetimeDefault = defaultISTDateTimeLocal(60); // +1h IST
          const isOpen = openFor === t.id;

          return (
            <article key={t.id} className="card p-4">
              <h3 className="font-semibold text-lg">{t.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{t.blurb}</p>
              <textarea
                readOnly
                className="mt-3 w-full h-32 text-sm border rounded-xl p-3 bg-gray-50"
                value={t.text}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a className="btn-primary" href={go} target="_blank" rel="noopener noreferrer">
                  Send on WhatsApp
                </a>
                <button
                  className="btn"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(t.text); } catch {}
                    const url = redirectUrl("template.copied", t.kind, effectiveSlug, providerId, t.text);
                    fetch(url + "&debug=0", { method: "GET", keepalive: true });
                    alert("Copied to clipboard ✓");
                  }}
                >
                  Copy
                </button>
                <button className="btn" onClick={() => setOpenFor(isOpen ? null : t.id)}>
                  {isOpen ? "Close" : "Schedule for later"}
                </button>
              </div>

              {isOpen && (
                <Scheduler
                  defaultISO={datetimeDefault}
                  onClose={() => setOpenFor(null)}
                  onConfirm={async (whenISO) => {
                    // MVP: log a schedule request; actual delivery handled by ops/cron later
                    const ok = await logEvent({
                      event: "template.schedule.requested",
                      ts: Date.now(),
                      provider_id: providerId, // can be null-safe if your DB requires; here Events likely allows null except we saw not-null earlier for provider_id
                      lead_id: null,
                      source: {
                        via: "ui",
                        kind: t.kind,
                        provider_slug: effectiveSlug || null,
                        whenISO,
                      },
                    });
                    setOpenFor(null);
                    if (ok) {
                      alert("Scheduled request logged ✓");
                    } else {
                      alert("Could not log schedule. Please try again.");
                    }
                  }}
                />
              )}

              {!providerId && (
                <p className="mt-2 text-xs text-amber-700">
                  Resolving provider… first click may not log; try again once resolved.
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
