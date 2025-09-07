// components/copilot/VeliPanel.tsx
// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Kind = "confirm" | "remind" | "reschedule" | "receipt";

function mkText(kind: Kind, { provider, amount, name, slot }: any) {
  const amt = amount ? `₹${amount}` : "your payment";
  const when = slot ? ` for ${slot} (IST)` : "";
  const who = name ? ` ${name}` : "";

  const map: Record<Kind, string> = {
    confirm: `Hi${who}, your booking with ${provider} is confirmed${when}. See you soon! — via Vyapr`,
    remind:  `Hi${who}, gentle reminder about your booking with ${provider}${when}. Reply here if you need to reschedule. — via Vyapr`,
    reschedule: `Hi${who}, I have a couple of alternate slots this week. Tell me your preference and I’ll confirm. — ${provider} via Vyapr`,
    receipt: `Hi${who}, thanks for ${amt} to ${provider}. Your booking is confirmed${when}. — via Vyapr`,
  };
  return map[kind];
}

export default function VeliPanel({ slug, provider }: { slug: string; provider: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("remind");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [slot, setSlot] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    // telemetry: opened
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "copilot.opened", provider_slug: slug, source: { surface: "dashboard" } }),
      keepalive: true,
    }).catch(() => {});
  }, [open, slug]);

  const text = useMemo(
    () => mkText(kind, { provider, amount, name, slot }),
    [kind, provider, amount, name, slot]
  );

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "copilot.suggest.copied", provider_slug: slug, source: { kind } }),
        keepalive: true,
      }).catch(() => {});
    });
  }

  function openWA() {
    const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "copilot.suggest.wa.opened", provider_slug: slug, source: { kind } }),
      keepalive: true,
    }).catch(() => {});
    window.open(href, "_blank", "noopener");
  }

  function onGenerate(k: Kind) {
    setKind(k);
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "copilot.suggest.created", provider_slug: slug, source: { kind: k } }),
      keepalive: true,
    }).catch(() => {});
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onGenerate("remind")}
        className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm"
      >
        Ask Veli (Co-pilot)
      </button>

      {open ? (
        <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setOpen(false)}>
          <div
            className="absolute right-4 top-4 w-full max-w-md rounded-2xl bg-white border p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Veli — WhatsApp co-pilot</h3>
              <button onClick={() => setOpen(false)} className="text-sm text-gray-500">✕</button>
            </div>

            <div className="flex gap-2 text-xs">
              {(["confirm","remind","reschedule","receipt"] as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => onGenerate(k)}
                  className={`px-2 py-1 rounded border ${k===kind ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"}`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="space-y-1">
                <div>Customer name</div>
                <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded border px-2 py-1" />
              </label>
              <label className="space-y-1">
                <div>Amount (₹)</div>
                <input inputMode="numeric" pattern="[0-9]*" value={amount}
                  onChange={(e)=>setAmount(e.target.value? Number(e.target.value) : "")}
                  className="w-full rounded border px-2 py-1" />
              </label>
              <label className="col-span-2 space-y-1">
                <div>Time (IST, optional)</div>
                <input value={slot} onChange={(e)=>setSlot(e.target.value)} placeholder="e.g., Tue 6:30 PM"
                  className="w-full rounded border px-2 py-1" />
              </label>
            </div>

            <textarea ref={taRef} className="w-full rounded border p-2 text-sm h-28" value={text} readOnly />

            <div className="flex gap-2">
              <button onClick={copy} className="rounded-lg bg-gray-900 text-white text-sm px-3 py-2">Copy</button>
              <button onClick={openWA} className="rounded-lg bg-emerald-600 text-white text-sm px-3 py-2">Open WhatsApp</button>
            </div>
            <div className="text-[11px] text-gray-500">Tips: tweak the fields above to regenerate copy.</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
