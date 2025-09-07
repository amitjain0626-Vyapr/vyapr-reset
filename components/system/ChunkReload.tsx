// components/system/ChunkReload.tsx
"use client";

import { useEffect } from "react";

export default function ChunkReload() {
  useEffect(() => {
    const reloadOnce = () => {
      const key = "__chunk_reload_at";
      const last = Number(sessionStorage.getItem(key) || 0);
      const now = Date.now();
      if (now - last > 15000) {
        sessionStorage.setItem(key, String(now));
        const url = new URL(window.location.href);
        url.searchParams.set("v", String(now));
        window.location.replace(url.toString());
      }
    };

    const onErr = (e: any) => {
      const name = (e?.reason?.name || e?.name || "").toString();
      const msg = (e?.message || e?.reason?.message || "").toString();
      if (name === "ChunkLoadError" || msg.includes("Loading chunk")) reloadOnce();
    };

    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
    };
  }, []);

  return null;
}
