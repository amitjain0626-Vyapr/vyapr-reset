// components/dashboard/SettingsClient.tsx
// @ts-nocheck
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Provider = {
  id: string | null;
  slug: string;
  display_name?: string | null;
  upi_id?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
};

type EventRow = {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source?: any;
};

function fmtIST(ts?: number | null) {
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(Number(ts) + 330 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ") + " IST";
}

export default function SettingsClient({ slug }: { slug: string }) {
  const [loadingProv, setLoadingProv] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [upi, setUpi] = useState("");
  const [upiHint, setUpiHint] = useState<string>("");

  const [nudge, setNudge] = useState({ quiet_start: 22, quiet_end: 8, cap: 25 });
  const [nudgeHint, setNudgeHint] = useState<string>("");

  // NEW: Working hours state (simple daily window)
  const [hours, setHours] = useState({ start_hour: 10, end_hour: 19 });
  const [hoursHint, setHoursHint] = useState<string>("");

  // 🔑 single source of truth for activity filtering
  const [providerId, setProviderId] = useState<string | null>(null);

  const [actLoading, setActLoading] = useState(true);
  const [activity, setActivity] = useState<EventRow[]>([]);
  const [actErr, setActErr] = useState<string | null>(null);

  // 1) Resolve providerId via cron endpoint (robust)
  useEffect(() => {
    let mounted = true;
    async function loadProviderId() {
      try {
        if (!slug) { setProviderId(null); return; }
        const res = await fetch(`/api/cron/nudges?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setProviderId(json?.provider_id || null);
      } catch {
        if (mounted) setProviderId(null);
      }
    }
    loadProviderId();
    return () => { mounted = false; };
  }, [slug]);

  // 2) Load provider (UI hints only)
  useEffect(() => {
    let mounted = true;
    async function loadProvider() {
      setLoadingProv(true);
      try {
        if (!slug) { setProvider(null); setUpi(""); return; }
        const { data } = await supabase
          .from("Providers")
          .select("id, slug, display_name, upi_id, phone, whatsapp")
          .eq("slug", slug)
          .maybeSingle();
        if (!mounted) return;
        setProvider((data as any) || { id: null, slug });
        setUpi(((data as any)?.upi_id || "").toString());
      } finally {
        if (mounted) setLoadingProv(false);
      }
    }
    loadProvider();
    return () => { mounted = false; };
  }, [slug]);

  const displayName = useMemo(
    () => provider?.display_name || slug || "your provider",
    [provider?.display_name, slug]
  );

  // 3) Activity loader → uses providerId
  const loadActivity = useCallback(async () => {
    setActErr(null);
    if (!providerId) { setActivity([]); setActLoading(false); return; }
    setActLoading(true);
    try {
      const res = await fetch("/api/debug/events?limit=200", { cache: "no-store" });
      const json = await res.json();
      const rows: EventRow[] = Array.isArray(json?.rows) ? json.rows : [];

      const pid = String(providerId);
      const keep = rows
        .filter(
          (r) =>
            String(r?.provider_id) === pid &&
            (r?.event === "provider.upi.saved" ||
             r?.event === "nudge.config.updated" ||
             r?.event === "provider.hours.saved")
        )
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, 25);

      setActivity(keep);
    } catch {
      setActErr("Could not load activity");
      setActivity([]);
    } finally {
      setActLoading(false);
    }
  }, [providerId]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // helpers (post events)
  async function postEvent(payload: any) {
    try {
      const res = await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ ts: Date.now() }, payload)),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  // handlers
  async function onSaveUPI(e: React.FormEvent) {
    e.preventDefault();
    const re = /^[a-z0-9._-]{2,256}@[a-z]{2,64}$/i;
    if (!upi.trim()) { setUpiHint("Enter a UPI"); return; }
    if (!re.test(upi.trim())) { setUpiHint("Invalid format"); return; }
    setUpiHint("Saving…");
    const out = await postEvent({
      event: "provider.upi.saved",
      provider_slug: slug,
      source: { upi_id: upi.trim().toLowerCase() },
    });
    setUpiHint(out?.ok ? "UPI saved ✅" : "Save failed ❌");
    if (out?.ok) loadActivity();
  }

  async function onSaveNudge(e: React.FormEvent) {
    e.preventDefault();
    const qs = Math.max(0, Math.min(23, Number(nudge.quiet_start)));
    const qe = Math.max(0, Math.min(23, Number(nudge.quiet_end)));
    const cap = Math.max(1, Math.min(500, Number(nudge.cap)));
    setNudgeHint("Saving…");
    const out = await postEvent({
      event: "nudge.config.updated",
      provider_slug: slug,
      source: { quiet_start: qs, quiet_end: qe, cap },
    });
    setNudgeHint(out?.ok ? "Config saved ✅" : "Save failed ❌");
    if (out?.ok) loadActivity();
  }

  // NEW: save working hours (simple daily window)
  async function onSaveHours(e: React.FormEvent) {
    e.preventDefault();
    const sh = Math.max(0, Math.min(23, Number(hours.start_hour)));
    const eh = Math.max(0, Math.min(23, Number(hours.end_hour)));
    if (eh <= sh) {
      setHoursHint("End must be greater than Start");
      return;
    }
    setHoursHint("Saving…");
    const out = await postEvent({
      event: "provider.hours.saved",
      provider_slug: slug,
      source: { start_hour: sh, end_hour: eh },
    });
    setHoursHint(out?.ok ? "Hours saved ✅" : "Save failed ❌");
    if (out?.ok) loadActivity();
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings — {displayName}</h1>
      <p className="text-sm text-gray-600">
        Provider slug: <span className="font-mono">{slug || "—"}</span>
      </p>

      {/* UPI */}
      <form onSubmit={onSaveUPI} className="rounded-xl border p-4 bg-white space-y-3 mt-4">
        <label className="block text-sm font-medium">UPI ID</label>
        <input
          name="upi"
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="eg. amit.jain0626@okaxis"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          disabled={!slug || loadingProv}
        >
          Save UPI
        </button>
        <div
          className="text-xs mt-1"
          style={{ color: upiHint.includes("✅") ? "#047857" : upiHint ? "#b91c1c" : "#6b7280" }}
        >
          {upiHint || ""}
        </div>
      </form>

      {/* Nudge config */}
      <form onSubmit={onSaveNudge} className="rounded-xl border p-4 bg-white space-y-3">
        <h2 className="text-lg font-medium">Nudge Settings</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm">Quiet Start (hour)</label>
            <input
              type="number" min={0} max={23}
              className="w-20 rounded border px-2 py-1 text-sm"
              value={nudge.quiet_start}
              onChange={(e) => setNudge((s) => ({ ...s, quiet_start: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm">Quiet End (hour)</label>
            <input
              type="number" min={0} max={23}
              className="w-20 rounded border px-2 py-1 text-sm"
              value={nudge.quiet_end}
              onChange={(e) => setNudge((s) => ({ ...s, quiet_end: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm">Daily Cap</label>
            <input
              type="number" min={1} max={500}
              className="w-24 rounded border px-2 py-1 text-sm"
              value={nudge.cap}
              onChange={(e) => setNudge((s) => ({ ...s, cap: Number(e.target.value) }))}
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          disabled={!slug || loadingProv}
        >
          Save Nudge Config
        </button>
        <div
          className="text-xs mt-1"
          style={{ color: nudgeHint.includes("✅") ? "#047857" : nudgeHint ? "#b91c1c" : "#6b7280" }}
        >
          {nudgeHint || ""}
        </div>
      </form>

      {/* NEW: Working Hours */}
      <form onSubmit={onSaveHours} className="rounded-xl border p-4 bg-white space-y-3">
        <h2 className="text-lg font-medium">Working Hours</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm">Start (hour)</label>
            <input
              type="number" min={0} max={23}
              className="w-20 rounded border px-2 py-1 text-sm"
              value={hours.start_hour}
              onChange={(e) => setHours((s) => ({ ...s, start_hour: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm">End (hour)</label>
            <input
              type="number" min={1} max={23}
              className="w-20 rounded border px-2 py-1 text-sm"
              value={hours.end_hour}
              onChange={(e) => setHours((s) => ({ ...s, end_hour: Number(e.target.value) }))}
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          disabled={!slug || loadingProv}
        >
          Save Hours
        </button>
        <div
          className="text-xs mt-1"
          style={{ color: hoursHint.includes("✅") ? "#047857" : hoursHint ? "#b91c1c" : "#6b7280" }}
        >
          {hoursHint || ""}
        </div>
        <p className="text-xs text-gray-500">MVP: one daily window. Slot-picker will only show slots inside this.</p>
      </form>

      {/* Activity Log */}
      <section className="rounded-xl border p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Activity Log</h2>
            <p className="text-xs text-gray-500">Recent UPI, Nudge & Hours changes</p>
          </div>
          <button type="button" onClick={loadActivity} className="text-xs underline hover:opacity-80">
            Reload
          </button>
        </div>

        {actLoading ? (
          <div className="text-sm text-gray-500 mt-2">Loading…</div>
        ) : actErr ? (
          <div className="text-sm text-red-600 mt-2">{actErr}</div>
        ) : activity.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">No recent activity yet.</div>
        ) : (
          <div className="space-y-2 mt-2">
            {activity.map((r, i) => {
              const label =
                r.event === "provider.upi.saved"
                  ? `UPI saved → ${r?.source?.upi_id || "—"}`
                  : r.event === "nudge.config.updated"
                  ? `Nudge updated → q${r?.source?.quiet_start ?? "?"}-q${r?.source?.quiet_end ?? "?"}, cap ${r?.source?.cap ?? "?"}`
                  : `Hours saved → ${r?.source?.start_hour ?? "?"}:00–${r?.source?.end_hour ?? "?"}:00`;
              return (
                <div key={i} className="flex items-center justify-between rounded border px-3 py-2">
                  <div className="text-sm">{label}</div>
                  <div className="text-xs text-gray-500">{fmtIST(r.ts)}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 text-xs">
          Tip: Cron respects the latest saved config. Use{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">/api/cron/nudges?slug={slug || "…"}</code> to verify.
        </div>
      </section>
    </>
  );
}
