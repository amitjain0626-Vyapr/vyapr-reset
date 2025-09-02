// @ts-nocheck
"use client";

import { useMemo, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Page is client-only to avoid the "await in non-async" build issue and to let us log telemetry.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Audience = "All" | "New" | "Repeat";

type TemplateDef = {
  id: string;
  title: string;
  base: string; // copy with placeholders: {amount}, {count}, {expiryDays}
  audienceHint?: Audience[];
  imageUrl?: string | null;
};

const TEMPLATES: TemplateDef[] = [
  {
    id: "offer-basic",
    title: "Limited-time Offer",
    base:
      "Hi 👋 This week only: book {count} slots and save ₹{amount}. Offer valid {expiryDays} days. Reply YES to confirm.",
    audienceHint: ["All"],
  },
  {
    id: "reactivate",
    title: "We Miss You",
    base:
      "It’s been a while! Book your next visit and get ₹{amount} off. Code: VYAPR. Valid for {expiryDays} days.",
    audienceHint: ["Repeat"],
  },
  {
    id: "new-welcome",
    title: "Welcome New Client",
    base:
      "Welcome to our clinic 🙏 First-visit special: ₹{amount} off. Limited to first {count} bookings. Expires in {expiryDays} days.",
    audienceHint: ["New"],
  },
];

function nowMs() {
  return Date.now();
}

function buildMessage(t: TemplateDef, values: { amount: string; count: string; expiryDays: string }) {
  const safe = (s: string) => (s ?? "").toString().trim();
  return t.base
    .replaceAll("{amount}", safe(values.amount) || "500")
    .replaceAll("{count}", safe(values.count) || "5")
    .replaceAll("{expiryDays}", safe(values.expiryDays) || "7");
}

function waDeeplink(text: string) {
  // Open WhatsApp composer with only text (number optional). Providers can pick contact.
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

async function logEvent(event: string, source: any) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        ts: nowMs(),
        // provider_id is resolved server-side in existing API; we pass slug in source for trace
        source,
      }),
    });
  } catch {
    // no-op
  }
}

type TileState = {
  audience: Audience;
  amount: string;
  count: string;
  expiryDays: string;
  imageUrl: string;
  analytics?: { sends7d: number; opens7d: number };
};

export default function TemplatesPage() {
  const sp = useSearchParams();
  const slug = sp.get("slug") || "";

  const [state, setState] = useState<Record<string, TileState>>(() =>
    Object.fromEntries(
      TEMPLATES.map((t) => [
        t.id,
        {
          audience: (t.audienceHint?.[0] as Audience) || "All",
          amount: "500",
          count: "5",
          expiryDays: "7",
          imageUrl: "",
          analytics: { sends7d: 0, opens7d: 0 },
        },
      ])
    )
  );

  // Mini analytics: derive from /api/debug/events (best-effort; safe if endpoint exists)
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/debug/events?event=template.sent.deeplink&limit=200`, {
          signal: abort.signal,
        });
        const data = await r.json();
        const rows: any[] = data?.rows || [];
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const next = { ...state };
        for (const t of TEMPLATES) {
          const sent = rows.filter(
            (row) =>
              row?.event === "template.sent.deeplink" &&
              row?.ts >= cutoff &&
              row?.source?.template_id === t.id
          ).length;
          // opened proxy: template.opened; if none, mirror sent for now
          const opened = rows.filter(
            (row) =>
              row?.event === "template.opened" &&
              row?.ts >= cutoff &&
              row?.source?.template_id === t.id
          ).length;
          next[t.id] = {
            ...next[t.id],
            analytics: { sends7d: sent, opens7d: opened },
          };
        }
        setState(next);
      } catch {
        // best-effort only
      }
    })();
    return () => abort.abort();
  }, []); // load once

  const onChange = (id: string, patch: Partial<TileState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const onPreview = async (t: TemplateDef) => {
    const st = state[t.id];
    const msg = buildMessage(t, st);
    await logEvent("template.previewed", {
      template_id: t.id,
      audience: st.audience,
      slug,
      placeholders: { amount: st.amount, count: st.count, expiryDays: st.expiryDays },
    });
    // Show a lightweight preview modal via window.open to a data URL
    const previewUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(msg);
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const onSend = async (t: TemplateDef) => {
    const st = state[t.id];
    const msg = buildMessage(t, st);
    const url = waDeeplink(msg);
    await logEvent("template.sent.deeplink", {
      template_id: t.id,
      audience: st.audience,
      slug,
      placeholders: { amount: st.amount, count: st.count, expiryDays: st.expiryDays },
      image_url: st.imageUrl || null,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const audienceChip = (active: boolean, label: Audience) =>
    `px-2 py-1 rounded-full text-xs border ${
      active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300"
    }`;

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">🧰 Template Packs</h1>
        <div className="text-xs text-gray-500">Provider: {slug || "—"}</div>
      </div>

      {/* Info bar */}
      <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 text-sm">
        <p className="font-medium">Ready-to-send messages.</p>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>Edit ₹/count/expiry above each preview.</li>
          <li>Pick audience tags (telemetry only for now).</li>
          <li>“Preview” opens the exact text; “Open WhatsApp” fills the message.</li>
        </ul>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => {
          const st = state[t.id];
          const msg = buildMessage(t, st);
          return (
            <div key={t.id} className="rounded-2xl border p-4 bg-white space-y-3 shadow-sm">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">{t.title}</h2>
                <div className="flex gap-2">
                  {(["All", "New", "Repeat"] as Audience[]).map((a) => (
                    <button
                      key={a}
                      className={audienceChip(st.audience === a, a)}
                      onClick={() => onChange(t.id, { audience: a })}
                      aria-label={`Audience ${a}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline placeholder editors */}
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-gray-600">
                  ₹ Amount
                  <input
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={st.amount}
                    onChange={(e) => onChange(t.id, { amount: e.target.value })}
                    inputMode="numeric"
                    placeholder="500"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Count
                  <input
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={st.count}
                    onChange={(e) => onChange(t.id, { count: e.target.value })}
                    inputMode="numeric"
                    placeholder="5"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Expiry (days)
                  <input
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={st.expiryDays}
                    onChange={(e) => onChange(t.id, { expiryDays: e.target.value })}
                    inputMode="numeric"
                    placeholder="7"
                  />
                </label>
              </div>

              {/* Optional media add-on (URL only for now) */}
              <label className="text-xs text-gray-600 block">
                Image URL (optional)
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={st.imageUrl}
                  onChange={(e) => onChange(t.id, { imageUrl: e.target.value })}
                  placeholder="https://…"
                />
                <span className="text-[11px] text-gray-500">
                  Note: WhatsApp may not auto-attach images from links. Add manually if needed.
                </span>
              </label>

              {/* Preview box */}
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {msg}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-md bg-white border text-sm hover:bg-gray-50"
                  onClick={() => onPreview(t)}
                >
                  Preview
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                  onClick={() => onSend(t)}
                >
                  Open WhatsApp
                </button>
              </div>

              {/* Mini analytics (7d) */}
              <div className="text-xs text-gray-600">
                Last 7 days: <span className="font-medium">{st.analytics?.sends7d ?? 0}</span> sends ·{" "}
                <span className="font-medium">{st.analytics?.opens7d ?? 0}</span> opens
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
