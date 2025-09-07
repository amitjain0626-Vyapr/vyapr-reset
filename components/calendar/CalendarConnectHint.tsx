// components/calendar/CalendarConnectHint.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

export default function CalendarConnectHint() {
  const [needsConnect, setNeedsConnect] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/google-calendar/health", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;

        // Show the banner when:
        // - no session (401), or
        // - 400 no_google_token, or
        // - ok:true but has no primary calendar info
        if (res.status === 401) setNeedsConnect(true);
        else if (res.status === 400 && (json?.error === "no_google_token" || json?.status === "PERMISSION_DENIED")) setNeedsConnect(true);
        else if (json?.ok === true && !json?.primary) setNeedsConnect(true);
        else setNeedsConnect(false);
      } catch {
        // On errors, be silent; don't block the page
        setNeedsConnect(false);
      } finally {
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (checking || !needsConnect) return null;

  return (
    <div className="rounded-2xl border p-3 bg-amber-50 text-amber-900 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="text-sm">
        📅 Connect Google Calendar to auto-block booked slots and avoid double bookings.
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/login?e=calendar_reconnect"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-1.5 text-white shadow hover:bg-amber-700 transition text-sm"
        >
          Connect Calendar
        </a>
        <a
          href="/help/calendar"
          className="text-xs underline decoration-dotted"
        >
          Learn more
        </a>
      </div>
    </div>
  );
}
