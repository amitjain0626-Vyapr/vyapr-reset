// components/referral/ReferralCard.tsx
// @ts-nocheck
"use client";

import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";

export default function ReferralCard({
  slug,
  providerName,
}: {
  slug: string;
  providerName?: string | null;
}) {
  // Centralized base URL (no hard-coded vyapr domain)
  const base = BRAND.baseUrl;

  const referralUrl = useMemo(
    () => `${base}/r/${encodeURIComponent(slug)}`,
    [base, slug]
  );

  const waText = useMemo(() => {
    const lines = [
      "Hi!",
      `I’m using ${BRAND.name} to manage bookings and payments.`,
      `You can set up your page in minutes — here’s my invite link: ${referralUrl}`,
    ];
    return encodeURIComponent(lines.join(" "));
  }, [referralUrl]);

  const waShare = `https://wa.me/?text=${waText}`;
  const [copied, setCopied] = useState(false);

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Invite a friend — help them go live</div>
          <div className="text-xs text-gray-600">
            Share your link. When they sign up, we’ll attribute the referral to you.
          </div>
          <div className="mt-2">
            <code className="text-xs bg-gray-50 border rounded px-2 py-1">
              {referralUrl}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={waShare}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 transition text-sm"
            aria-label="Share on WhatsApp"
          >
            💬 Share on WhatsApp
          </a>
          <button
            type="button"
            onClick={doCopy}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
