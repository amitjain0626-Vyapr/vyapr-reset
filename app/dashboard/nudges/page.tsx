// app/dashboard/nudges/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

/* -------------------------------- Types --------------------------------- */
type NudgeEvent = { lead_id: string | null; ts: number; source: any };
type NudgesConfig = {
  ok: boolean;
  provider_id: string | null;
  is_quiet: boolean;
  allowed: boolean;
  remaining: number;
  windowHours?: number;
  config?: { quiet_start?: number; quiet_end?: number; cap?: number };
} | null;

type UpsellResp = {
  ok: boolean;
  slug: string;
  nudges: Array<{ key: string; label: string; kind: string; action_url: string; meta?: any }>;
} | null;

/* ------------------------------ Helpers --------------------------------- */
function maskDigits(d: string) {
  const s = (d || "").replace(/[^\d]/g, "");
  if (s.length <= 4) return s;
  return `${s.slice(0, s.length - 4).replace(/\d/g, "•")}${s.slice(-4)}`;
}

function originSafe() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_BASE_URL || "https://app.korekko.com";
}

function buildText(providerName: string, leadName?: string) {
  const hi = leadName?.trim() ? `Hi ${leadName.trim()},` : "Hi!";
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  const payUrl = `${originSafe()}/pay/TEST`;
  return {
    text: [
      hi,
      `This is a friendly reminder to complete your pending payment with ${providerName}.`,
      `You can pay here: ${payUrl}`,
      `Ref: ${ref}`,
    ].join("\n"),
    ref,
  };
}

function q(obj: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    p.set(k, String(v));
  });
  return p.toString();
}

/* ------------------------------- Page ----------------------------------- */
export default function NudgesPage(props: { searchParams?: { slug?: string; window?: string } }) {
  const slug = (props?.searchParams?.slug || "").trim();
  const winToken = (props?.searchParams?.window || "d30").trim().toLowerCase();

  const win = useMemo(() => (winToken === "h24" ? { key: "h24", label: "last 24 hours" } : { key: "d30", label: "last 30 days" }), [winToken]);

  if (!slug) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Nudge Center</h1>
        <p className="text-sm text-red-600 mt-2">Missing ?slug= in URL.</p>
      </main>
    );
  }

  const [providerName, setProviderName] = useState<string>(slug);
  const [providerId, setProviderId] = useState<string | null>(null);

  const [cfg, setCfg] = useState<NudgesConfig>(null);
  const [nudges, setNudges] = useState<NudgeEvent[]>([]);
  const [fallback, setFallback] = useState<NonNullable<UpsellResp>["nudges"]>([]);
  const [loading, setLoading] = useState(false);

  /* --------------------------- Load provider ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!cancelled) {
          setProviderName((j?.provider?.business_name || j?.provider?.name || j?.provider?.slug || slug) as string);
          setProviderId(j?.provider?.id || j?.id || null);
        }
      } catch {
        if (!cancelled) {
          setProviderName(slug);
          setProviderId(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  /* -------------------------- Load config + data ------------------------ */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetch(`/api/cron/nudges?${q({ slug })}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
      setCfg(c && c.ok ? (c as NudgesConfig) : null);

      const events = await fetch(`/api/debug/events/recent?${q({ slug, event: "nudge.suggested", window: win.key })}`, { cache: "no-store" })
        .then(r => r.json())
        .catch(() => ({ ok: false, rows: [] }));
      const rows: NudgeEvent[] = Array.isArray(events?.rows) ? events.rows : [];
      setNudges(rows);

      if (!rows.length) {
        const u = await fetch(`/api/upsell?${q({ slug })}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        setFallback(Array.isArray(u?.nudges) ? u.nudges.slice(0, 4) : []);
      } else {
        setFallback([]);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, win.key]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ---------------------------- Derived -------------------------------- */
  const quietStart = cfg?.config?.quiet_start ?? 22;
  const quietEnd = cfg?.config?.quiet_end ?? 8;
  const cap = cfg?.config?.cap ?? 25;
  const remaining = cfg?.remaining ?? 0;
  const isQuiet = !!cfg?.is_quiet;
  const allowedNow = !!cfg?.allowed;

  /* -------------------------- Actions (client) -------------------------- */
  async function logBatch(count: number) {
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "nudge.batch.sent",
          ts: Date.now(),
          provider_id: providerId,
          lead_id: null,
          source: { via: "ui", count, window: win.key },
        }),
      });
    } catch {}
  }

  // === VYAPR: Playbooks trigger START (22.18) ===
  async function logPlaybook(leadId: string | null, playbook: "reactivation" | "reminder" | "offer" = "reminder") {
    try {
      await fetch(`/api/playbooks/send?${q({ slug })}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, playbook }),
      });
    } catch {}
  }
  // === VYAPR: Playbooks trigger END (22.18) ===

  function onBatchSend() {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-test="nudge-send"]'));
    const allowed = Math.max(0, Math.min(remaining, anchors.length));
    const CAP = 6;
    const openN = Math.min(CAP, allowed);

    if (isQuiet || openN <= 0) {
      logBatch(0);
      return;
    }
    let opened = 0;
    (async () => {
      for (let i = 0; i < openN; i++) {
        const a = anchors[i];
        if (!a) break;
        const href = a.getAttribute("href");
        if (!href) continue;

        const leadId = (a.dataset?.leadId || "").trim() || null;

        window.open(href, "_blank", "noopener,noreferrer");
        opened++;

        await new Promise((r) => setTimeout(r, 150));
        await logPlaybook(leadId, "reminder");
      }
      logBatch(opened);
    })();
  }

  /* ------------------------------- Render -------------------------------- */
  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Nudge Center</h1>
          <div className="text-sm text-gray-600">Provider: <span className="font-mono">{slug}</span></div>
          <div className="text-xs text-gray-500">Showing: {win.label}</div>
        </div>
        <a href={`/dashboard/leads?slug=${encodeURIComponent(slug)}`} className="text-emerald-700 underline">
          ← Back to Leads
        </a>
      </div>

      {/* Window switcher */}
      <nav className="flex items-center gap-2">
        <a
          href={`/dashboard/nudges?${q({ slug, window: "h24" })}`}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${win.key === "h24" ? "bg-black text-white border-black" : "bg-white hover:shadow-sm"}`}
          data-test="win-h24"
        >
          Last 24h
        </a>
        <a
          href={`/dashboard/nudges?${q({ slug, window: "d30" })}`}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${win.key === "d30" ? "bg-black text-white border-black" : "bg-white hover:shadow-sm"}`}
          data-test="win-d30"
        >
          Last 30d
        </a>
      </nav>

      {/* Schedule & limits */}
      <section
        className={`rounded-lg border p-4 ${allowedNow ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
        data-test="nudge-config"
      >
        <div className="text-sm font-medium">Schedule & limits</div>
        <div className="mt-1 text-sm text-gray-700">
          Quiet hours (IST): <span className="font-mono">{quietStart}:00 → {quietEnd}:00</span> ·{" "}
          Daily cap: <span className="font-mono">{cap}</span> ·{" "}
          Remaining today: <span className="font-mono">{remaining}</span> ·{" "}
          Status:{" "}
          <span className={`font-medium ${allowedNow ? "text-emerald-700" : "text-amber-700"}`}>
            {allowedNow ? "Sends allowed now" : isQuiet ? "Quiet hours" : "Cap exhausted"}
          </span>
        </div>
      </section>

      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm text-gray-600">
          {loading ? "Loading suggestions…" : `Suggested WhatsApp reminders from ${win.label}.`}
        </div>
      </div>

      {/* Batch send summary */}
      <section
        className="rounded-xl border p-4 bg-white"
        data-test="nudge-batch-ui"
        data-total={nudges.length}
        data-remaining={remaining}
        data-isquiet={isQuiet ? "1" : "0"}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Batch send (summary)</div>
            <div className="text-xs text-gray-600 mt-1">
              Ready to send now:{" "}
              <span className="font-mono">{Math.max(0, Math.min(remaining, nudges.length))}</span>{" "}
              of <span className="font-mono">{nudges.length}</span> suggestions · Remaining today:{" "}
              <span className="font-mono">{remaining}</span> · Quiet hours:{" "}
              <span className="font-mono">{isQuiet ? "ON" : "OFF"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onBatchSend}
            disabled={nudges.length === 0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${nudges.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"}`}
            title={isQuiet ? "Quiet hours active — sends paused" : remaining <= 0 ? "Daily cap exhausted — click still logs (0)" : "Opens WhatsApp for allowed suggestions"}
          >
            Batch send
          </button>
        </div>
      </section>

      {/* Fallback actions */}
      {nudges.length === 0 && fallback.length > 0 && (
        <section className="rounded-xl border p-4 bg-white">
          <div className="text-sm font-semibold mb-2">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            {fallback.map((n) => {
              const to = n.action_url || "#";
              const tracked = `/api/events/redirect?${q({
                event: "upsell.nudge.clicked",
                slug,
                key: n.key,
                to,
              })}`;
              return (
                <a
                  key={n.key}
                  href={tracked}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm"
                >
                  {n.label}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Nudges list */}
      <div className="space-y-3">
        {nudges.length === 0 && fallback.length === 0 && !loading && (
          <div className="text-sm text-gray-500">No suggestions right now.</div>
        )}

        {nudges.map((n, idx) => {
          const phone = (n?.source?.target || "").toString();
          const leadName = "";
          const { text } = buildText(providerName, leadName);

          const p = new URLSearchParams();
          p.set("provider_id", providerId || "");
          if (n.lead_id) p.set("lead_id", n.lead_id);
          p.set("phone", phone.replace(/[^\d]/g, ""));
          p.set("text", text);
          p.set("ref", Math.random().toString(36).slice(2, 8).toUpperCase());
          const href = `/api/track/wa-collect?${p.toString()}`;

          return (
            <div key={idx} className="rounded-xl border p-3 bg-white" data-test="nudge-item">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{leadName || "Lead"} — {maskDigits(phone)}</div>
                  <div className="text-xs text-gray-500">Suggested at {new Date(n.ts).toLocaleString("en-IN")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    title="Open WhatsApp with prefilled reminder"
                    data-test="nudge-send"
                    data-lead-id={n.lead_id || ""}
                  >
                    Send on WhatsApp
                  </a>

                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium border hover:shadow-sm"
                    title="Collect pending payment"
                    onClick={async () => {
                      try {
                        const params = { slug, template: "collect_pending", amt: (n?.source?.amount_inr ?? n?.source?.pending ?? n?.source?.amount) || "", lang: "en" };
                        const r = await fetch(`/api/templates/preview?${q(params)}`, { cache: "no-store" });
                        const j = await r.json().catch(() => ({}));
                        const serverText = (j?.preview?.text || "").toString();

                        const phoneDigits = phone.replace(/[^\d]/g, "");
                        if (!phoneDigits) return;

                        const textFinal =
                          serverText ||
                          `Hi, please complete your pending payment with ${providerName}. Pay here: ${originSafe()}/pay/TEST`;

                        const wa = `https://api.whatsapp.com/send/?phone=${phoneDigits}&text=${encodeURIComponent(textFinal)}&type=phone_number&app_absent=0`;
                        window.open(wa, "_blank", "noopener,noreferrer");
                      } catch {}
                    }}
                  >
                    Collect ₹
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap" data-test="nudge-preview">
                {text}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
