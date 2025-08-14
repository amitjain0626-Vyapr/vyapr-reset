// @ts-nocheck
"use client";

import { useState } from "react";
import { createOrder, verifyPayment, recordPayment } from "./payment-actions";

export default function ClientPayNow({ slug, amount, currency = "INR" }) {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePayNow = async () => {
    setLoading(true);
    setErrMsg(null);
    setSuccessMsg(null);

    // Step 1: Create order
    const order = await createOrder(slug, amount, currency);
    if (!order?.ok) {
      setErrMsg(
        typeof order?.error === "string"
          ? order.error
          : JSON.stringify(order?.error || "Could not create order", null, 2)
      );
      setLoading(false);
      return;
    }

    try {
      // Step 2: Use Razorpay Checkout
      const razorpay = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Vyapr",
        description: "Service Booking Payment",
        order_id: order.id,
        handler: async (response: any) => {
          // Step 3: Verify payment
          const verify = await verifyPayment(response);
          if (!verify?.ok) {
            setErrMsg(
              typeof verify?.error === "string"
                ? verify.error
                : JSON.stringify(
                    verify?.error || "Payment verification failed",
                    null,
                    2
                  )
            );
            return;
          }

          // Step 4: Record payment
          const record = await recordPayment(slug, verify);
          if (!record?.ok) {
            setErrMsg(
              typeof record?.error === "string"
                ? record.error
                : JSON.stringify(
                    record?.error || "Payment record failed",
                    null,
                    2
                  )
            );
            return;
          }

          setSuccessMsg("Payment successful!");
        },
        theme: { color: "#3399cc" },
      });

      razorpay.open();
    } catch (e: any) {
      setErrMsg(e?.message || "Payment could not start");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {errMsg && (
        <div className="text-sm text-red-600 p-2 bg-red-50 rounded whitespace-pre-wrap">
          {errMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-sm text-green-700 p-2 bg-green-50 rounded">
          {successMsg}
        </div>
      )}

      <button
        onClick={handlePayNow}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>
    </div>
  );
}
