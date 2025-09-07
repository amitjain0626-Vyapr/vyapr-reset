// components/telemetry/LogOnMount.tsx
// @ts-nocheck
"use client";

import { useEffect } from "react";

type Payload = {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source: Record<string, any>;
};

export default function LogOnMount({ payload }: { payload: Payload }) {
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/events/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
      } catch {}
    })();
  }, []);

  return null;
}
