// app/book/[slug]/LandingTracker.tsx
// @ts-nocheck
"use client";

import { useEffect } from "react";

/**
 * Logs booking.landing.opened when the booking page is opened
 * with utm_source=whatsapp or campaign=template-pack.
 * Telemetry contract: {event, ts(ms), provider_id, lead_id, source}
 */
export default function LandingTracker({ slug, providerId }: { slug: string; providerId?: string | null }) {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const src = sp.get("utm_source");
      const camp = sp.get("utm_campaign") || sp.get("campaign");
      if (src === "whatsapp" || camp === "template-pack") {
        fetch("/api/events/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "booking.landing.opened",
            ts: Date.now(),
            provider_id: providerId || null,
            lead_id: null,
            source: {
              via: "ui",
              provider_slug: slug,
              utm_source: src,
              campaign: camp,
            },
          }),
          keepalive: true,
        });
      }
    } catch {}
  }, [slug, providerId]);

  return null;
}
