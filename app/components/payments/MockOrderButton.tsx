"use client";
// @ts-nocheck
import { useState } from "react";

export default function MockOrderButton({ amountPaise = 49900 }: { amountPaise?: number }) {
  const [loading, setLoading] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async () => {
    setLoading(true);
    setError(null);
    setLastOrderId(null);
    try {
      const res = await fetch("/api/payments/razorpay-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountPaise }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed");
      }
      setLastOrderId(data?.order?.provider_order_id || data?.order?.id || "created");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={createOrder}
        disabled={loading}
        className="px-4 py-2 rounded-xl border"
      >
        {loading ? "Creating…" : "Create Mock Order (₹499)"}
      </button>
      {lastOrderId && (
        <div className="text-sm">
          ✅ Order created: <b>{lastOrderId}</b>
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600">
          ✗ {error}
        </div>
      )}
    </div>
  );
}
