// components/calendar/CalendarStatusPill.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

export default function CalendarStatusPill() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/google-calendar/health", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;

        // Treat as connected if the health endpoint succeeds and returns either a primary calendar
        // or simply ok:true (some accounts may hide list but still allow event insert).
        if (res.ok && json?.ok === true) setConnected(true);
        else setConnected(false);
      } catch {
        setConnected(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (connected !== true) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
      Calendar connected
    </span>
  );
}
