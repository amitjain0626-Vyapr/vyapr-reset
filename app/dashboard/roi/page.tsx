"use client";
// app/dashboard/roi/page.tsx
// @ts-nocheck

import { useEffect, useMemo, useState } from "react";

type Summary = {
  ok: boolean;
  verified7: number;             // treated as "Leads (verified) 7d"
  bookings7: number;             // Bookings 7d
  verifiedToBookingsPct7: number;
  // Optional fields (if your /api/roi/summary returns them)
  pending?: number;              // Pending amount (generic or 7d)
  pending7?: number;             // Pending amount (7d)
  paid7?: number;                // Paid leads count (7d) — preferred
  payments7?: number;            // Payments count (7d) — fallback
  mtd?: number;
  lmtd?: number;
};

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(n)));
  } catch {
    return `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;
  }
}

/* === INSERT: IST helpers + events typing (no schema drift) === */
type EvRow = { event: string; ts: number; source?: any };
function startOfTodayIST(): number {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find(p => p.type === "year")?.value || "0");
  const m = Number(parts.find(p => p.type === "month")?.value || "0");
  const d = Number(parts.find(p => p.type === "day")?.value || "0");
  // IST midnight expressed in UTC
  return Date.UTC(y, m - 1, d, -5, -30);
}
/* === INSERT END === */

export default function RoiPage() {
  const [slug, setSlug] = useState("amitjain0626");
  const [sum, setSum] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  /* === INSERT: Revenue states (Today/7D/30D) === */
  const [revToday, setRevToday] = useState(0);
  const [rev7, setRev7] = useState(0);
  const [rev30, setRev30] = useState(0);
  const [evtLoading, setEvtLoading] = useState(false);
  /* === INSERT END === */

  /* === INSERT: read ?slug= from URL on mount (keeps your input too) === */
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const qSlug = (u.searchParams.get("slug") || "").trim();
      if (qSlug) setSlug(qSlug);
    } catch {}
  }, []);
  /* === INSERT END === */

  async function load(nextSlug?: string) {
    const s = (nextSlug ?? slug).trim();
    if (!s) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/roi/summary?provider_slug=${encodeURIComponent(s)}`, { cache: "no-store" });
      const j = await r.json();
      setSum(j);
    } finally {
      setLoading(false);
    }
  }

  /* === INSERT: fetch recent payment.success events to compute ₹ totals === */
  async function loadRevenue(s: string) {
    const use = (s || "").trim();
    if (!use) return;
    setEvtLoading(true);
    try {
      const r = await fetch(`/api/debug/events?limit=1000`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      const rows: EvRow[] = Array.isArray(j?.rows) ? j.rows : (Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []));

      const pay = rows.filter(
        (e) =>
          e?.event === "payment.success" &&
          (e?.source?.slug === use || e?.source?.provider_slug === use)
      );

      const amtINR = (e: EvRow) => {
        const a = Number(e?.source?.amount);
        const cur = String(e?.source?.currency || "INR").toUpperCase();
        return Number.isFinite(a) && cur === "INR" ? a : 0;
      };

      const now = Date.now();
      const t0 = startOfTodayIST();
      const t7 = now - 7 * 24 * 60 * 60 * 1000;
      const t30 = now - 30 * 24 * 60 * 60 * 1000;

      setRevToday(pay.filter((e) => e.ts >= t0).reduce((s, e) => s + amtINR(e), 0));
      setRev7(pay.filter((e) => e.ts >= t7).reduce((s, e) => s + amtINR(e), 0));
      setRev30(pay.filter((e) => e.ts >= t30).reduce((s, e) => s + amtINR(e), 0));
    } finally {
      setEvtLoading(false);
    }
  }
  /* === INSERT END === */

  useEffect(() => {
    load(slug);
    loadRevenue(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Pending amount (defensive) ----
  const pendingAmt = useMemo(() => {
    const p7 = typeof sum?.pending7 === "number" ? sum.pending7 : null;
    const p = typeof sum?.pending === "number" ? sum.pending : null;
    return Math.max(0, Math.round((p7 ?? p ?? 0) || 0));
  }, [sum]);

  // ---- Conversion math (defensive) ----
  const l2bPct = useMemo(() => {
    const leads = Number(sum?.verified7 || 0);
    const bookings = Number(sum?.bookings7 || 0);
    if (!leads) return null;
    return Math.max(0, Math.round((bookings / leads) * 100));
  }, [sum]);

  const paidCount7 = useMemo(() => {
    if (typeof sum?.paid7 === "number") return Math.max(0, Math.round(sum.paid7));
    if (typeof sum?.payments7 === "number") return Math.max(0, Math.round(sum.payments7));
    return null;
  }, [sum]);

  const b2pPct = useMemo(() => {
    const bookings = Number(sum?.bookings7 || 0);
    const paid = paidCount7 ?? 0;
    if (!bookings || paidCount7 == null) return null;
    return Math.max(0, Math.round((paid / bookings) * 100));
  }, [sum, paidCount7]);

  const overallPct = useMemo(() => {
    const leads = Number(sum?.verified7 || 0);
    const paid = paidCount7 ?? 0;
    if (!leads || paidCount7 == null) return null;
    return Math.max(0, Math.round((paid / leads) * 100));
  }, [sum, paidCount7]);

  // ---- Preview API link for Collect CTA (English default) ----
  const collectPreviewHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("slug", (slug || "").trim());
    params.set("template", "collect_pending");
    if (pendingAmt > 0) params.set("amt", String(pendingAmt));
    return `/api/templates/preview?${params.toString()}`;
  }, [slug, pendingAmt]);

  // ---- Boost visibility link ----
  const boostHref = useMemo(() => {
    const u = new URL(`/upsell`, typeof window === "undefined" ? "https://korekko-reset.vercel.app" : window.location.origin);
    u.searchParams.set("slug", (slug || "").trim());
    u.searchParams.set("utm_source", "dashboard");
    u.searchParams.set("utm_medium", "cta");
    u.searchParams.set("utm_campaign", "boost_visibility");
    return u.toString();
  }, [slug]);

  /* === INSERT: simulate button + refresh === */
  async function simulate500() {
    try {
      await fetch(`/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, amount: 500, currency: "INR", via: "roi" }),
      });
      await Promise.all([load(slug), loadRevenue(slug)]);
    } catch {}
  }
  /* === INSERT END === */

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">ROI</h1>

      <div className="rounded border p-3 bg-gray-50 flex items-center gap-2">
        <label className="text-sm text-gray-600">Provider slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="border px-2 py-1 text-sm rounded"
        />
        <button
          onClick={() => { load(slug); loadRevenue(slug); }}
          className="ml-2 rounded bg-blue-600 px-3 py-1 text-sm text-white"
        >
          {loading || evtLoading ? "Refreshing…" : "Refresh"}
        </button>
        {/* Quick simulate to avoid blank dashboards */}
        <button
          onClick={simulate500}
          className="ml-2 rounded border px-3 py-1 text-sm"
          title="Simulate a ₹500 payment event"
        >
          Simulate ₹500
        </button>
      </div>

      {/* === INSERT: Revenue (Today / 7D / 30D) tiles === */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-4" title="Payments captured today (IST)">
          <div className="text-sm text-gray-500">Revenue Today</div>
          <div className="text-2xl font-semibold">{fmtINR(revToday)}</div>
          <div className="text-xs text-gray-500 mt-1">Sum of payment.success (INR)</div>
        </div>
        <div className="rounded border p-4" title="Payments in last 7 days">
          <div className="text-sm text-gray-500">Revenue (7d)</div>
          <div className="text-2xl font-semibold">{fmtINR(rev7)}</div>
        </div>
        <div className="rounded border p-4" title="Payments in last 30 days">
          <div className="text-sm text-gray-500">Revenue (30d)</div>
          <div className="text-2xl font-semibold">{fmtINR(rev30)}</div>
        </div>
      </section>
      {/* === INSERT END === */}

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded border p-4" title="Leads verified in last 7 days → Bookings made in last 7 days">
          <div className="text-sm text-gray-500">Verified → Bookings (7d)</div>
          <div className="text-2xl font-semibold">
            {sum?.verifiedToBookingsPct7 ?? (l2bPct ?? 0)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {sum ? `${sum.verified7} verified → ${sum.bookings7} bookings` : "—"}
          </div>
        </div>

        <div className="rounded border p-4" title="Leads verified in the last 7 days">
          <div className="text-sm text-gray-500">Verified (7d)</div>
          <div className="text-2xl font-semibold">{sum?.verified7 ?? 0}</div>
        </div>

        <div className="rounded border p-4" title="Bookings confirmed in the last 7 days">
          <div className="text-sm text-gray-500">Bookings (7d)</div>
          <div className="text-2xl font-semibold">{sum?.bookings7 ?? 0}</div>
        </div>

        {/* Pending ₹ */}
        <div className="rounded border p-4" title="Unpaid bookings amount (rolling 7 days if available)">
          <div className="text-sm text-gray-500">Pending ₹ (7d)</div>
          <div className="text-2xl font-semibold">{fmtINR(pendingAmt)}</div>
          <div className="text-xs text-gray-500 mt-1">
            Unpaid bookings in the last 7 days
          </div>
        </div>
      </section>

      {/* Conversion % tiles */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-4" title="Leads → Paid in last 7 days">
          <div className="text-sm text-gray-500">Conversion % (overall 7d)</div>
          <div className="text-2xl font-semibold">
            {overallPct == null ? "—" : `${overallPct}%`}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Leads → Paid (uses paid7/payments7 if available)
          </div>
        </div>
        <div className="rounded border p-4" title="Verified leads → Bookings in last 7 days">
          <div className="text-sm text-gray-500">Leads → Bookings</div>
          <div className="text-2xl font-semibold">
            {l2bPct == null ? "—" : `${l2bPct}%`}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {sum ? `${sum.verified7 ?? 0} → ${sum.bookings7 ?? 0}` : "—"}
          </div>
        </div>
        <div className="rounded border p-4" title="Bookings → Paid in last 7 days">
          <div className="text-sm text-gray-500">Bookings → Paid</div>
          <div className="text-2xl font-semibold">
            {b2pPct == null ? "—" : `${b2pPct}%`}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {paidCount7 == null ? "—" : `${sum?.bookings7 ?? 0} → ${paidCount7}`}
          </div>
        </div>
      </section>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={collectPreviewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 transition"
          aria-label="Collect pending payments (preview)"
          title="Open WhatsApp message preview to collect pending payments"
        >
          💬 Collect pending payments (Preview)
        </a>

        <a
          href={boostHref}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-600 px-4 py-2 text-indigo-700 bg-white hover:bg-indigo-50 transition"
          aria-label="Boost visibility"
          title="Discoverability, reminders, review helpers"
        >
          🚀 Boost visibility
        </a>

        <a
          href={`/templates?slug=${encodeURIComponent(slug)}`}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 transition"
          aria-label="Template packs"
          title="Pre-filled WhatsApp templates"
        >
          🧰 Template packs
        </a>
      </div>
    </main>
  );
}
