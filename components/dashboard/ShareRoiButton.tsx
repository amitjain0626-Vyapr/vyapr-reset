// @ts-nocheck
"use client";

import { useState } from "react";
const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

export default function ShareRoiButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SITE}/api/analytics/export?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.wa_url) {
        window.open(j.wa_url, "_blank", "noopener");
      } else if (j?.text) {
        await navigator.clipboard.writeText(j.text);
        alert("ROI proof copied ✓");
      } else {
        alert("Could not build ROI proof.");
      }
    } catch {
      alert("Failed to build ROI proof.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="block text-center rounded-full border px-3 py-2 text-sm hover:shadow-sm"
      onClick={handleShare}
      disabled={loading}
      title="Creates a WhatsApp-forwardable ROI summary"
    >
      {loading ? "Preparing…" : "Share ROI Proof"}
    </button>
  );
}
