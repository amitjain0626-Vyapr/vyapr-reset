"use client";
// @ts-nocheck
import { useState } from "react";

export default function CreateTestOrderButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_in_paise: 49900, currency: "INR" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create order");
      const id = data?.order?.id || "unknown";
      const provider = (data?.provider || "mock").toUpperCase();
      const warn = data?.dbWarning ? ` (DB warn: ${data.dbWarning})` : "";
      setMsg(`✅ ${provider} order created: ${id}${warn}`);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-xl px-4 py-2 border disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create Test Order (₹499)"}
      </button>
      {msg && <div>{msg}</div>}
      {err && <div>❌ {err}</div>}
    </div>
  );
}
