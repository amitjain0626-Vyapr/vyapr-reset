// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

export default function KillSW() {
  const [log, setLog] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        // Unregister all service workers
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        if (regs && regs.length) {
          for (const r of regs) await r.unregister();
        }
        // Clear caches
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        // Nuke storage hints
        if (window.localStorage) localStorage.clear();
        if (window.sessionStorage) sessionStorage.clear();

        setLog(
          `SW unregistered: ${regs?.length || 0}. Caches cleared. Do a hard reload (Cmd+Shift+R) and retry onboarding.`
        );
      } catch (e: any) {
        setLog(`Error while clearing SW/caches: ${e?.message || String(e)}`);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Kill Service Worker</h1>
      <p className="text-sm text-gray-600 mb-4">
        This page unregisters all service workers and clears caches for this origin.
      </p>
      <pre className="rounded bg-gray-100 p-3 text-xs whitespace-pre-wrap">{log}</pre>
      <p className="mt-4 text-sm">
        After you see the success message above, press <strong>Cmd+Shift+R</strong> (Hard Reload), then try onboarding again.
      </p>
    </div>
  );
}
