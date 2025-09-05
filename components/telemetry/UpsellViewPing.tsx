// components/telemetry/UpsellViewPing.tsx
// @ts-nocheck
"use client";

import { useEffect } from "react";

export default function UpsellViewPing({
  slug,
  providerId,
}: {
  slug: string;
  providerId: string | null;
}) {
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        await fetch("/api/events/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "upsell.nudge.viewed",
            ts: Date.now(),
            provider_id: providerId,
            lead_id: null,
            source: { via: "upsell.page", slug },
          }),
        });
      } catch {}
    })();
  }, [slug, providerId]);

  return null;
}
