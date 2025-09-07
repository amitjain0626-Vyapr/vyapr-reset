// app/book/[slug]/BookingInstrumentation.tsx
// @ts-nocheck
"use client";
import { useEffect } from "react";

export default function BookingInstrumentation({ providerId }: { providerId?: string | null }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const lid = url.searchParams.get("lid");
    const utm_source = url.searchParams.get("utm_source") || null;
    const utm_medium = url.searchParams.get("utm_medium") || null;
    const utm_campaign = url.searchParams.get("utm_campaign") || null;

    // accept only UUID as lead_id; otherwise send null and keep raw for debugging/attribution
    const uuidRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const lead_id_clean = typeof lid === "string" && uuidRE.test(lid) ? lid : null;
    const lid_raw = lid || null;

    // A) landing ping
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "booking.landing.opened",
        ts: Date.now(),
        provider_id: providerId || null,
        lead_id: lead_id_clean,
        source: { via: "web", utm_source, utm_medium, campaign: utm_campaign, lid_raw },
      }),
      keepalive: true,
    });

    // B) intent ping on primary CTA
    const handleClick = () => {
      const nowUrl = new URL(window.location.href);
      const lid2 = nowUrl.searchParams.get("lid");
      const lead_id_clean2 = typeof lid2 === "string" && uuidRE.test(lid2) ? lid2 : null;
      const lid_raw2 = lid2 || null;

      fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "booking.intent.clicked",
          ts: Date.now(),
          provider_id: providerId || null,
          lead_id: lead_id_clean2,
          source: {
            via: "web",
            utm_source,
            utm_medium,
            campaign: utm_campaign,
            cta: "book-now",
            lid_raw: lid_raw2,
          },
        }),
        keepalive: true,
      });
    };

    const btn = document.getElementById("vyapr-book-now");
    btn?.addEventListener("click", handleClick);

    return () => {
      btn?.removeEventListener("click", handleClick);
    };
  }, [providerId]);

  return null;
}
