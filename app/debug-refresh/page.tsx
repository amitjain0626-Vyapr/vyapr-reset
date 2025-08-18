// app/debug-refresh/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function DebugRefresh() {
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Unregister all service workers
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        // Clear all caches
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        setDone(true);
        // Redirect to dashboard with a cache-busting query
        setTimeout(() => {
          const v = Date.now();
          window.location.href = `/dashboard/leads?v=${v}`;
        }, 800);
      } catch (e: any) {
        setErrors(e?.message || "Unknown error clearing caches");
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1>Refreshing App Cache…</h1>
      <p>This will unregister the PWA service worker and clear caches, then reload the Leads dashboard.</p>
      <pre style={{ marginTop: 16, background: "#f6f7f9", padding: 12, borderRadius: 8 }}>
        {errors ? `Error: ${errors}` : done ? "Service workers unregistered and caches cleared." : "Working…"}
      </pre>
    </div>
  );
}
