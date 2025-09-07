// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Audience = "All" | "New" | "Repeat";

type TemplateDef = {
  id: string;
  title: string;           // tile title
  base: string;            // text with {amount},{count},{expiryDays}
  audienceHint?: Audience[];
};

type Category = string;

const PROVIDER_ID_FALLBACKS: Record<string, string> = {
  // verified earlier
  amitjain0626: "c56d7dac-c9ed-4828-9c52-56a445fce7b3",
};

function nowMs() {
  return Date.now();
}

function buildMessage(
  t: TemplateDef,
  values: { amount: string; count: string; expiryDays: string }
) {
  const safe = (s: string) => (s ?? "").toString().trim();
  return t.base
    .replaceAll("{amount}", safe(values.amount) || "500")
    .replaceAll("{count}", safe(values.count) || "5")
    .replaceAll("{expiryDays}", safe(values.expiryDays) || "7");
}

async function logEvent(event: string, provider_slug: string, source: any) {
  const provider_id = PROVIDER_ID_FALLBACKS[provider_slug] || "";
  const body = {
    event,
    ts: nowMs(),
    provider_id,
    source: { provider_slug: provider_slug || null, ...source },
  };
  const payload = JSON.stringify(body);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const ok = navigator.sendBeacon("/api/events/log", new Blob([payload], { type: "application/json" }));
    if (ok) return;
  }
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {}
}

type TileState = {
  audience: Audience;
  amount: string;
  count: string;
  expiryDays: string;
  imageUrl: string;
  analytics?: { sends7d: number; opens7d: number };
  pinned?: boolean;
};

const defaultTileState = (t: TemplateDef): TileState => ({
  audience: (t.audienceHint?.[0] as Audience) || "All",
  amount: "500",
  count: "5",
  expiryDays: "7",
  imageUrl: "",
  analytics: { sends7d: 0, opens7d: 0 },
  pinned: false,
});

export default function GalleryClient() {
  const sp = useSearchParams();
  const slug = sp.get("slug") || "";
  const tgParam = (sp.get("tg") || "").toLowerCase() || "dentist";

  // Load templates (data-driven)
  const [catalog, setCatalog] = useState<Record<string, TemplateDef[]>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/data/templates.json", { cache: "no-store" });
        const j = await r.json();
        if (mounted) setCatalog(j?.categories || {});
      } catch {
        if (mounted) setCatalog({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const TEMPLATES: TemplateDef[] = useMemo(() => {
    const arr = catalog[tgParam] || [];
    if (arr.length > 0) return arr;
    return [
      {
        id: "fallback-offer",
        title: "Limited-time Offer",
        base:
          "Hi 👋 This week only: book {count} slots and save ₹{amount}. Offer valid {expiryDays} days. Reply YES to confirm.",
        audienceHint: ["All"],
      },
    ];
  }, [catalog, tgParam]);

  const [state, setState] = useState<Record<string, TileState>>({});

  // Initialize per current template list
  useEffect(() => {
    const next = Object.fromEntries(TEMPLATES.map((t) => [t.id, defaultTileState(t)]));
    setState(next);
  }, [TEMPLATES]);

  // Mini analytics (best-effort)
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/debug/events?limit=200`, { signal: abort.signal });
        const data = await r.json();
        const rows: any[] = data?.rows || [];
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const next: Record<string, TileState> = { ...state };
        for (const t of TEMPLATES) {
          const sent = rows.filter(
            (row) =>
              row?.event === "template.sent.deeplink" &&
              row?.ts >= cutoff &&
              row?.source?.template_id === t.id
          ).length;
          const opened = rows.filter(
            (row) =>
              row?.event === "template.opened" &&
              row?.ts >= cutoff &&
              row?.source?.template_id === t.id
          ).length;
          const cur = next[t.id] ?? defaultTileState(t);
          next[t.id] = { ...cur, analytics: { sends7d: sent, opens7d: opened } };
        }
        setState(next);
      } catch {}
    })();
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TEMPLATES.length]);

  const onChange = (id: string, patch: Partial<TileState>) =>
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? defaultTileState({ id, title: "", base: "" } as any)), ...patch } }));

  const onPreview = async (t: TemplateDef) => {
    const st = state[t.id] ?? defaultTileState(t);
    const msg = buildMessage(t, st);

    // Verify endpoint
    const verifyUrl =
      `/api/templates/preview?slug=${encodeURIComponent(slug)}` +
      `&tid=${encodeURIComponent(t.id)}&a=${encodeURIComponent(st.audience)}` +
      `&amt=${encodeURIComponent(st.amount)}&cnt=${encodeURIComponent(st.count)}` +
      `&exp=${encodeURIComponent(st.expiryDays)}&msg=${encodeURIComponent(msg)}`;

    await logEvent("template.previewed", slug, {
      category: tgParam,
      template_id: t.id,
      audience: st.audience,
      placeholders: { amount: st.amount, count: st.count, expiryDays: st.expiryDays },
    });

    const previewUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(msg);
    window.open(previewUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => window.open(verifyUrl, "_blank", "noopener,noreferrer"), 25);
  };

  const onSend = (t: TemplateDef) => {
    const st = state[t.id] ?? defaultTileState(t);
    const msg = buildMessage(t, st);
    const tracker =
      `/api/t?slug=${encodeURIComponent(slug)}&tid=${encodeURIComponent(t.id)}` +
      `&a=${encodeURIComponent(st.audience)}&amt=${encodeURIComponent(st.amount)}` +
      `&cnt=${encodeURIComponent(st.count)}&exp=${encodeURIComponent(st.expiryDays)}` +
      `&msg=${encodeURIComponent(msg)}`;

    void logEvent("template.sent.deeplink", slug, {
      category: tgParam,
      template_id: t.id,
      audience: st.audience,
      placeholders: { amount: st.amount, count: st.count, expiryDays: st.expiryDays },
      image_url: st.imageUrl || null,
    });

    setTimeout(() => {
      window.open(tracker, "_blank", "noopener,noreferrer");
    }, 50);
  };

  const onPin = async (t: TemplateDef) => {
    const st = state[t.id] ?? defaultTileState(t);
    const nextPinned = !st.pinned;
    setState((s) => ({ ...s, [t.id]: { ...st, pinned: nextPinned } }));
    await logEvent(nextPinned ? "template.pinned" : "template.unpinned", slug, {
      category: tgParam,
      template_id: t.id,
      audience: st.audience,
    });
  };

  const audienceChip = (active: boolean) =>
    `px-2 py-1 rounded-full text-xs border ${
      active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300"
    }`;

  if (loading) {
    return (
      <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 text-sm">
        Loading templates…
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 text-sm">
        <p className="font-medium">Ready-to-send messages.</p>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>Edit ₹/count/expiry above each preview.</li>
          <li>Pick audience chips (for reporting only).</li>
          <li>“Preview” shows text + verify JSON. “Open WhatsApp” is tracked.</li>
          <li>Use the ⭐ to pin top templates.</li>
        </ul>
        <div className="text-xs text-gray-500 mt-2">
          Provider: {slug || "—"} · Category: <span className="font-medium">{tgParam}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => {
          const st = state[t.id] ?? defaultTileState(t);
          const msg = buildMessage(t, st);
          return (
            <div key={t.id} className="rounded-2xl border p-4 bg-white space-y-3 shadow-sm">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">{t.title}</h2>
                <div className="flex items-center gap-2">
                  {(["All", "New", "Repeat"] as Audience[]).map((a) => (
                    <button
                      key={a}
                      className={audienceChip(st.audience === a)}
                      onClick={() => onChange(t.id, { audience: a })}
                      aria-label={`Audience ${a}`}
                      title="Audience tag (reporting only)"
                    >
                      {a}
                    </button>
                  ))}
                  <button
                    onClick={() => onPin(t)}
                    aria-label={st.pinned ? "Unpin template" : "Pin template"}
                    title={st.pinned ? "Unpin from Dashboard" : "Pin to Dashboard"}
                    className={`ml-1 text-sm px-2 py-1 rounded-md border ${
                      st.pinned ? "bg-yellow-100 border-yellow-300" : "bg-white border-gray-300"
                    }`}
                  >
                    {st.pinned ? "⭐ Pinned" : "☆ Pin"}
                  </button>
                </div>
              </div>

              {/* Inline placeholder editors */}
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-gray-600" title="Discount amount in rupees">
                  ₹ Amount
                  <input
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={st.amount}
                    onChange={(e) => onChange(t.id, { amount: e.target.value })}
                    inputMode="numeric"
                    placeholder="500"
                  />
                </label>
                <label className="text-xs text-gray-600" title="How many bookings this applies to">
                  Count
                  <input
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={st.count}
                    onChange={(e) => onChange(t.id, { count: e.target.value })}
                    inputMode="numeric"
                    placeholder="5"
                  />
                </label>
                <label className="text-xs text-gray-600" title="Offer validity in days">
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
              <label className="text-xs text-gray-600 block" title="Optional image URL to add in WA">
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
              <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap" title="Message preview">
                {msg}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-md bg-white border text-sm hover:bg-gray-50"
                  onClick={() => onPreview(t)}
                  title="Open plain text preview + verify JSON"
                >
                  Preview (Verify)
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                  onClick={() => onSend(t)}
                  title="Open WhatsApp with this message (tracked)"
                >
                  Open WhatsApp
                </button>
              </div>

              {/* Mini analytics (7d) */}
              <div className="text-xs text-gray-600" title="Activity in last 7 days">
                Last 7 days: <span className="font-medium">{st.analytics?.sends7d ?? 0}</span> sends ·{" "}
                <span className="font-medium">{st.analytics?.opens7d ?? 0}</span> opens
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
