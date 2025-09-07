// components/dashboard/OnboardingClient.tsx
"use client";
// @ts-nocheck

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function OnboardingClient({ slug }: { slug: string }) {
  const [upi, setUpi] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Persisted progress flags (loaded from Events)
  const [step1Done, setStep1Done] = useState(false); // UPI saved
  const [step2Done, setStep2Done] = useState(false); // test reminder
  const [step3Done, setStep3Done] = useState(false); // ROI opened

  // Resolve provider_id for reliable filtering
  const [providerId, setProviderId] = useState<string | null>(null);

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

  // Load persisted progress from Events
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      if (!providerId) return;
      try {
        const res = await fetch("/api/debug/events?limit=200", { cache: "no-store" });
        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        const pid = String(providerId);

        const hasUPI = rows.some((r: any) => String(r?.provider_id) === pid && r?.event === "provider.upi.saved");
        const didReminder = rows.some(
          (r: any) => String(r?.provider_id) === pid && r?.event === "onboarding.step.done" && r?.source?.step === "test.reminder"
        );
        const openedROI = rows.some(
          (r: any) => String(r?.provider_id) === pid && r?.event === "onboarding.step.done" && r?.source?.step === "roi.opened"
        );

        if (!mounted) return;
        setStep1Done(!!hasUPI);
        setStep2Done(!!didReminder);
        setStep3Done(!!openedROI);
        if (hasUPI) setMsg("UPI saved ✅");
      } catch {
        // ignore for MVP
      }
    }
    loadProgress();
    return () => { mounted = false; };
  }, [providerId]);

  const total = 3;
  const done = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const nextStep = useMemo(() => {
    if (!step1Done) return "Save your UPI to unlock receipts.";
    if (!step2Done) return "Send yourself a test reminder on WhatsApp.";
    if (!step3Done) return "Open your ROI dashboard.";
    return "All set — explore Leads.";
  }, [step1Done, step2Done, step3Done]);

  async function saveUpi() {
    setMsg(null);
    setErr(null);
    if (!slug || !upi) {
      setErr("Please enter UPI and ensure slug is present in the URL.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "provider.upi.saved",
          provider_slug: slug,
          source: { upi_id: upi },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErr(data?.error || `Failed (${res.status}).`);
        return;
      }
      setMsg("UPI saved ✅");
      setStep1Done(true);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const testHref = `https://wa.me/${encodeURIComponent(
    "919873284544"
  )}?text=${encodeURIComponent(
    `Hi, this is a test reminder from Vyapr for slug ${slug}.`
  )}`;

  return (
    <>
      {/* Progress header */}
      <section className="rounded-xl border p-4 bg-emerald-50 border-emerald-200">
        <div className="text-sm font-medium">Setup progress: {done}/{total} complete</div>
        <div className="text-xs text-emerald-900 mt-1">What’s next: {nextStep}</div>
      </section>

      {/* Step 1 */}
      <section className={`rounded-xl border p-4 bg-white space-y-3 ${step1Done ? "opacity-95" : ""}`}>
        <h2 className="text-lg font-medium">1) Save your UPI {step1Done ? "✅" : ""}</h2>
        <label className="block text-sm font-medium">UPI ID</label>
        <input
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="eg. yourname@bank"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {err && <div className="text-xs text-red-600">{err}</div>}
        {msg && <div className="text-xs text-green-700">{msg}</div>}
        <button
          type="button"
          onClick={saveUpi}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save UPI"}
        </button>
        <p className="text-xs text-gray-500">Needed for receipts and faster confirmations.</p>
      </section>

      {/* Step 2 */}
      <section className="rounded-xl border p-4 bg-white space-y-2">
        <h2 className="text-lg font-medium">2) Send a test reminder {step2Done ? "✅" : ""}</h2>
        <p className="text-sm text-gray-600">Opens WhatsApp with a sample message to yourself.</p>
        <a
          href={testHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
        >
          Open WhatsApp
        </a>

        {/* Mark the step as done */}
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/events/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "onboarding.step.done",
                provider_slug: slug,
                source: { step: "test.reminder" },
              }),
            });
            setStep2Done(true);
          }}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800"
        >
          Mark test as done
        </button>
      </section>

      {/* Step 3 */}
      <section className="rounded-xl border p-4 bg-white space-y-2">
        <h2 className="text-lg font-medium">3) Check your ROI dashboard {step3Done ? "✅" : ""}</h2>
        <p className="text-sm text-gray-600">See leads, bookings, and weekly growth.</p>
        <Link
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          href={`/dashboard/leads?slug=${encodeURIComponent(slug)}`}
          onClick={async () => {
            await fetch("/api/events/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "onboarding.step.done",
                provider_slug: slug,
                source: { step: "roi.opened" },
              }),
            });
            setStep3Done(true);
          }}
        >
          Open Dashboard
        </Link>
      </section>
    </>
  );
}
