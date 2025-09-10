// @ts-nocheck
"use client";

import * as React from "react";

type Props = {
  providerId?: string | null;
  slug?: string;
};

export default function BoostCard({ providerId, slug }: Props) {
  const upi = "amit.jain0626@okaxis";

  const handleBoost = async () => {
    // 1) telemetry
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "boost.checkout.started",
          ts: Date.now(),
          provider_id: providerId,
          lead_id: null,
          source: { via: "upsell", slug },
        }),
      });
    } catch {}

    // 2) open UPI intent (₹500 demo)
    const note = `Korekko Boost - ${slug || "provider"}`;
    const url = `upi://pay?pa=${encodeURIComponent(
      upi
    )}&pn=${encodeURIComponent("Korekko Boost")}&mc=0000&tid=${
      Date.now() + ""
    }&tr=${Date.now()}&tn=${encodeURIComponent(note)}&am=500&cu=INR`;
    window.location.href = url;
  };

  const handleActivate = async () => {
    // Manual activation (MVP) — no schema drift; state inferred from latest event.
    try {
      const res = await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "boost.enabled",
          ts: Date.now(),
          provider_id: providerId,
          lead_id: null,
          source: { via: "upsell", slug, mode: "manual" },
        }),
      });
      const ok = res.ok;
      // soft UI feedback
      alert(ok ? "Boost activated 🎉" : "Tried to activate Boost");
    } catch {
      alert("Tried to activate Boost");
    }
  };

  return (
    <div className="rounded-2xl border p-6 bg-indigo-50 text-indigo-900">
      <h2 className="text-lg font-semibold mb-1">🚀 Paid Discovery Boost</h2>
      <p className="text-sm mb-4">
        Appear on top of search results and directory. More visibility, more bookings.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleBoost}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-white text-sm shadow hover:bg-indigo-700 transition"
          data-test="boost-start-btn"
        >
          Start Boost (₹500)
        </button>

        {/* NEW: Manual activation CTA (MVP) */}
        <button
          onClick={handleActivate}
          className="rounded-xl border border-indigo-600 px-4 py-2 text-indigo-700 bg-white text-sm hover:bg-indigo-50 transition"
          data-test="boost-activate-btn"
          title="I’ve paid — activate Boost now"
        >
          I’ve paid, activate Boost
        </button>
      </div>

      <div className="mt-3 text-xs text-indigo-900/80">
        Payment note will include your slug: <code>{slug || "—"}</code>
      </div>
    </div>
  );
}
