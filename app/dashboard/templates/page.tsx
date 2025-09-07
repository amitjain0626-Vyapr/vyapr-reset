"use client";
// app/dashboard/templates/page.tsx
// @ts-nocheck

import { useEffect, useMemo, useState } from "react";

type Channel = "whatsapp";
type Category = "generic" | "dentist" | "astrologer" | "salon" | "fitness";

type Template = {
  key: string;
  title: string;
  channel: Channel;
  category: Category;
  body: string; // with {{vars}}
};

// -------- Seeded templates (safe guardrails; short, respectful, action-oriented) ----------
const ALL_TEMPLATES: Template[] = [
  // Generic
  {
    key: "vyapr.generic.reactivation.1",
    title: "We miss you",
    channel: "whatsapp",
    category: "generic",
    body: "👋 Hi {{name}}, it’s {{provider}}. Haven’t seen you in a while — book your next visit today: {{link}}",
  },
  {
    key: "vyapr.generic.reminder.1",
    title: "Friendly reminder",
    channel: "whatsapp",
    category: "generic",
    body: "⏰ Reminder: your slot on {{date}} at {{time}}. Reply YES to confirm, or tap to reschedule: {{link}}",
  },
  {
    key: "vyapr.generic.offer.1",
    title: "Limited slots this week",
    channel: "whatsapp",
    category: "generic",
    body: "🎉 Popular slots are filling fast this week. Tap to find a time that works for you: {{link}}",
  },

  // Dentist
  {
    key: "vyapr.dentist.reactivation.1",
    title: "Dental check-up due",
    channel: "whatsapp",
    category: "dentist",
    body: "🦷 Hi {{name}}, {{provider}} here. You’re due for a dental check-up — pick a slot here: {{link}}",
  },
  {
    key: "vyapr.dentist.reminder.1",
    title: "Today’s appointment",
    channel: "whatsapp",
    category: "dentist",
    body: "🗓️ Reminder: {{service}} on {{date}} at {{time}}. Reply YES to confirm, or reschedule here: {{link}}",
  },

  // Astrologer
  {
    key: "vyapr.astro.reactivation.1",
    title: "New consultation window",
    channel: "whatsapp",
    category: "astrologer",
    body: "🔮 Hi {{name}}, {{provider}} here. New consultation slots are open — book now: {{link}}",
  },
  {
    key: "vyapr.astro.reminder.1",
    title: "Consult reminder",
    channel: "whatsapp",
    category: "astrologer",
    body: "🌙 Reminder: session on {{date}} at {{time}}. Reply YES to confirm, or change your slot: {{link}}",
  },

  // Salon
  {
    key: "vyapr.salon.reactivation.1",
    title: "Time for a refresh",
    channel: "whatsapp",
    category: "salon",
    body: "💇 Hi {{name}}, {{provider}} here. Fancy a quick refresh? Pick a convenient time: {{link}}",
  },

  // Fitness
  {
    key: "vyapr.fitness.reminder.1",
    title: "Class reminder",
    channel: "whatsapp",
    category: "fitness",
    body: "💪 Reminder: your {{service}} on {{date}} at {{time}}. Confirm with YES, or choose another slot: {{link}}",
  },
];

// -------- Helpers ----------
function encode(s: string) {
  try {
    return encodeURIComponent(s);
  } catch {
    return s;
  }
}

function substitute(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = vars?.[k];
    return (v ?? "").toString();
  });
}

// Build a WhatsApp URL (fallback if server didn’t supply one)
function buildWAUrl({ phone, text }: { phone: string; text: string }) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${encode(text)}&type=phone_number&app_absent=0`;
}

// -------- Component ----------
export default function TemplatesPage() {
  // Provider + context
  const [slug, setSlug] = useState("amitjain0626");

  // Preview context vars (lightweight controls; safe defaults)
  const [category, setCategory] = useState<Category>("generic");
  const [service, setService] = useState("Dental Check-up");
  const [provider, setProvider] = useState("Dr. Amit Jain");
  const [name, setName] = useState("Amit");
  const [phone, setPhone] = useState("+919999999999");
  const [date, setDate] = useState("4 Sept");
  const [time, setTime] = useState("6:00 PM");
  const [linkOverride, setLinkOverride] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<null | { text: string; whatsapp_url?: string }>(null);

  // NEW: pinning state (per provider)
  const [providerId, setProviderId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  // Filter by category
  const templates = useMemo(
    () => ALL_TEMPLATES.filter((t) => t.category === category),
    [category]
  );

  // Load provider ID + current pinned list when slug changes
  useEffect(() => {
    let cancelled = false;
    async function loadProviderAndPins() {
      try {
        // provider id
        const pRes = await fetch(`/api/providers/${encode(slug)}`, { cache: "no-store" });
        const pJson = await pRes.json().catch(() => ({}));
        if (!cancelled) setProviderId(pJson?.id || pJson?.provider?.id || null);
      } catch {
        if (!cancelled) setProviderId(null);
      }
      try {
        const r = await fetch(`/api/templates/pinned?slug=${encode(slug)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        const keys = Array.isArray(j?.items) ? j.items.map((x: any) => x.template_id) : [];
        if (!cancelled) setPinned(new Set(keys));
      } catch {
        if (!cancelled) setPinned(new Set());
      }
    }
    loadProviderAndPins();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setOk(null);
    setPreview(null);
  }, [slug, category, service, provider, name, phone, date, time, linkOverride]);

  // --- Server calls ---

  // Send a test reactivation (logs an event) and simultaneously request a preview.
  async function sendTest(t: Template) {
    setBusy(t.key);
    try {
      const qs = new URLSearchParams({ slug, test: "1" }).toString();
      const res = await fetch(`/api/campaigns/reactivate?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: t.key,
          channel: "whatsapp",
          preview: true,
          category,
          service,
          vars: {
            name,
            provider,
            phone,
            date,
            time,
            service,
            category,
            link: linkOverride || `${location.origin}/book/${slug}`,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      setOk(!!json?.ok);
      // Prefer server preview (authoritative)
      if (json?.preview?.text) {
        setPreview({ text: json.preview.text, whatsapp_url: json.preview.whatsapp_url });
      } else {
        // Fallback: client-side substitute
        const text = substitute(t.body, {
          name,
          provider,
          phone,
          date,
          time,
          service,
          category,
          link: linkOverride || `${location.origin}/book/${slug}`,
        });
        setPreview({ text, whatsapp_url: buildWAUrl({ phone, text }) });
      }
    } catch {
      setOk(false);
    } finally {
      setBusy(null);
    }
  }

  // Preview only (no logging side-effects other than the reactivation handler)
  async function previewTemplate(t: Template) {
    setBusy(t.key);
    try {
      const qs = new URLSearchParams({ slug }).toString();
      const res = await fetch(`/api/campaigns/reactivate?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          template_key: t.key,
          channel: "whatsapp",
          category,
          service,
          vars: {
            name,
            provider,
            phone,
            date,
            time,
            service,
            category,
            link: linkOverride || `${location.origin}/book/${slug}`,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      setOk(!!json?.ok);
      if (json?.preview?.text) {
        setPreview({ text: json.preview.text, whatsapp_url: json.preview.whatsapp_url });
      } else {
        const text = substitute(t.body, {
          name,
          provider,
          phone,
          date,
          time,
          service,
          category,
          link: linkOverride || `${location.origin}/book/${slug}`,
        });
        setPreview({ text, whatsapp_url: buildWAUrl({ phone, text }) });
      }
    } catch {
      setOk(false);
    } finally {
      setBusy(null);
    }
  }

  // NEW: pin/unpin helpers
  async function pinTemplate(t: Template) {
    if (!providerId) return;
    setPinBusy(t.key);
    try {
      const ts = Date.now();
      await fetch(`/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "template.pinned",
          ts,
          provider_id: providerId,
          source: {
            provider_slug: slug,
            template_id: t.key,
            category: t.category,
          },
        }),
      });
      setPinned((prev) => new Set(prev).add(t.key));
    } catch {
      // noop (we keep UX simple)
    } finally {
      setPinBusy(null);
    }
  }

  async function unpinTemplate(t: Template) {
    if (!providerId) return;
    setPinBusy(t.key);
    try {
      const ts = Date.now();
      await fetch(`/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "template.unpinned",
          ts,
          provider_id: providerId,
          source: {
            provider_slug: slug,
            template_id: t.key,
            category: t.category,
          },
        }),
      });
      setPinned((prev) => {
        const n = new Set(prev);
        n.delete(t.key);
        return n;
      });
    } catch {
      // noop
    } finally {
      setPinBusy(null);
    }
  }

  function openWhatsApp() {
    if (!preview?.text) return;
    const href = preview.whatsapp_url || buildWAUrl({ phone, text: preview.text });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copyText() {
    try {
      if (preview?.text) {
        await navigator.clipboard.writeText(preview.text);
        setOk(true);
      }
    } catch {
      setOk(false);
    }
  }

  // --- UI ---

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">WhatsApp Templates</h1>

      {/* Context bar */}
      <div className="rounded border p-3 bg-gray-50 grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Provider slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="e.g. amitjain0626"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="border px-2 py-1 text-sm rounded w-full"
          >
            <option value="generic">Generic</option>
            <option value="dentist">Dentist</option>
            <option value="astrologer">Astrologer</option>
            <option value="salon">Salon</option>
            <option value="fitness">Fitness</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Service</label>
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="Dental Check-up"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Provider</label>
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="Dr. Amit Jain"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="Amit"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="+919999999999"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Date</label>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="4 Sept"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Time</label>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder="6:00 PM"
          />
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <label className="text-sm text-gray-600 w-28">Link override</label>
          <input
            value={linkOverride}
            onChange={(e) => setLinkOverride(e.target.value)}
            className="border px-2 py-1 text-sm rounded w-full"
            placeholder={`https://vyapr-reset-5rly.vercel.app/book/${slug}`}
          />
          {ok !== null && (
            <span className={`text-xs ${ok ? "text-emerald-700" : "text-red-700"} ml-2`}>
              {ok ? "OK" : "Failed"}
            </span>
          )}
        </div>
      </div>

      {/* Templates grid */}
      <section className="grid gap-4 lg:grid-cols-2">
        {templates.map((t) => {
          const isPinned = pinned.has(t.key);
          return (
            <div key={t.key} className="rounded border border-gray-200 p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {t.title}{" "}
                  {isPinned && <span title="Pinned" className="ml-1">⭐</span>}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 border">
                  {t.category}
                </span>
              </div>

              <div className="text-sm text-gray-700 whitespace-pre-line">
                {t.body}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* NEW: Pin / Unpin */}
                <button
                  type="button"
                  disabled={!providerId || pinBusy === t.key}
                  onClick={() => (isPinned ? unpinTemplate(t) : pinTemplate(t))}
                  className={`rounded px-3 py-1 text-sm border ${isPinned ? "bg-yellow-100 border-yellow-300" : "bg-white"}`}
                  title={isPinned ? "Unpin this template" : "Pin this template"}
                >
                  {pinBusy === t.key
                    ? "Saving…"
                    : isPinned
                    ? "Unpin"
                    : "Pin"}
                </button>

                <button
                  type="button"
                  onClick={() => previewTemplate(t)}
                  disabled={busy === t.key}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {busy === t.key ? "Previewing…" : "Preview (fill vars)"}
                </button>
                <button
                  type="button"
                  onClick={() => sendTest(t)}
                  disabled={busy === t.key}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {busy === t.key ? "Sending…" : "Send test (WA)"}
                </button>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
                >
                  Open WhatsApp
                </button>
                <button
                  type="button"
                  onClick={copyText}
                  className="rounded bg-gray-200 px-3 py-1 text-sm"
                >
                  Copy text
                </button>
              </div>

              {/* Live preview panel */}
              {preview?.text && (
                <div className="mt-2 rounded bg-gray-50 p-2 text-xs space-y-1 border">
                  <div className="font-medium">Preview:</div>
                  <pre className="whitespace-pre-wrap">{preview.text}</pre>
                  {(preview.whatsapp_url || preview.text) && (
                    <a
                      href={preview.whatsapp_url || buildWAUrl({ phone, text: preview.text })}
                      target="_blank"
                      className="inline-block mt-1 underline text-blue-700"
                    >
                      Open in WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Helper links for quick sanity checks */}
      <section className="text-xs text-gray-500 pt-2 space-y-1">
        <div>
          Slots feed:{" "}
          <a className="underline" target="_blank" href={`https://vyapr-reset-5rly.vercel.app/api/debug/slots?slug=${encode(slug)}`}>
            https://vyapr-reset-5rly.vercel.app/api/debug/slots?slug={slug}
          </a>
        </div>
        <div>
          Booking page:{" "}
          <a className="underline" target="_blank" href={`https://vyapr-reset-5rly.vercel.app/book/${encode(slug)}`}>
            https://vyapr-reset-5rly.vercel.app/book/{slug}
          </a>
        </div>
      </section>
    </main>
  );
}
