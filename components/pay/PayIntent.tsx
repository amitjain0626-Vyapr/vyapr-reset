// components/pay/PayIntent.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

async function logEvent(payload: {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source: Record<string, any>;
}) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export default function PayIntent({
  leadId,
  providerSlug,
  amount,
  upiLink,
  allowInPerson = true,
}: {
  leadId: string;
  providerSlug?: string;
  amount?: number;
  upiLink: string;
  allowInPerson?: boolean;
}) {
  const [intent, setIntent] = useState<"upi" | "in_person" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // if provider disabled "in person", force UPI by default
    if (!allowInPerson) setIntent("upi");
  }, [allowInPerson]);

  async function chooseUPI() {
    setIntent("upi");
    setNote(null);
    // telemetry: user chose UPI (we'll also log when link is opened)
    await logEvent({
      event: "payment.method.selected",
      ts: Date.now(),
      provider_id: null, // resolved on server via slug if needed; null is acceptable per contract
      lead_id: leadId || null,
      source: { via: "web", method: "upi", amount: amount ?? null, slug: providerSlug || null },
    });
    // log link open then navigate to UPI link
    await logEvent({
      event: "payment.link.opened",
      ts: Date.now(),
      provider_id: null,
      lead_id: leadId || null,
      source: { via: "web", method: "upi", amount: amount ?? null, slug: providerSlug || null },
    });
    window.location.href = upiLink;
  }

  async function chooseInPerson() {
    setIntent("in_person");
    setNote("You chose to pay in person. The provider will note this for your visit.");
    await logEvent({
      event: "payment.method.selected",
      ts: Date.now(),
      provider_id: null,
      lead_id: leadId || null,
      source: { via: "web", method: "in_person", amount: amount ?? null, slug: providerSlug || null },
    });
  }

  return (
    <section className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="text-sm font-medium">Choose how you’d like to pay</div>
      <div className="flex gap-2">
        <button
          onClick={chooseUPI}
          className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${intent === "upi" ? "bg-emerald-50 border-emerald-300" : ""}`}
        >
          Pay now (UPI)
        </button>

        {allowInPerson && (
          <button
            onClick={chooseInPerson}
            className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${intent === "in_person" ? "bg-amber-50 border-amber-300" : ""}`}
          >
            Pay in person
          </button>
        )}
      </div>

      {note && <div className="text-xs text-gray-600">{note}</div>}

      {/* Provider flexibility note (hidden UI, but behavior enabled via URL): ?enableInPerson=0 to hide the option */}
      <div className="sr-only">Provider can disable “Pay in person” via link param enableInPerson=0</div>
    </section>
  );
}
