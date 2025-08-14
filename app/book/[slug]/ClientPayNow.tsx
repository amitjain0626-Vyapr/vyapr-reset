// @ts-nocheck
"use client";

import { useState } from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ClientPayNow({
  slug,
  providerName,
  amountPaise = 49900, // ₹499 default
}: {
  slug: string;
  providerName: string;
  amountPaise?: number;
}) {
  const [loading, setLoading] = useState(false);

  const ensureRazorpay = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.body.appendChild(s);
    });

  const startPayment = async () => {
    try {
      setLoading(true);
      await ensureRazorpay();

      // 1) Create order
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `rcpt_${slug}_${Date.now()}`,
        }),
      }).then((r) => r.json());

      if (!orderRes?.ok) {
        alert("Could not create order");
        setLoading(false);
        return;
      }

      const { order, key_id } = orderRes;

      // 2) Open checkout
      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: providerName,
        description: "Booking advance",
        order_id: order.id,
        theme: { color: "#0f766e" },
        handler: async function (response: any) {
          try {
            // 3) Verify + record payment
            const verify = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                slug,
                amount: amountPaise,
              }),
            }).then((r) => r.json());

            if (verify?.ok) {
              window.location.href = `/book/${slug}?paid=1`;
            } else {
              alert("Payment record failed: " + (verify?.error || "unknown"));
            }
          } catch {
            alert("Payment verification failed");
          }
        },
      });

      rzp.open();
      setLoading(false);
    } catch (e) {
      console.error(e);
      alert("Payment could not start");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={startPayment}
      disabled={loading}
      className="w-full bg-teal-700 text-white px-4 py-2 rounded"
    >
      {loading ? "Starting…" : "Pay ₹499 now"}
    </button>
  );
}
