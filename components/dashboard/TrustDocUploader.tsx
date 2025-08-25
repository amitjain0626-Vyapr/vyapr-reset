// @ts-nocheck
"use client";

import { useState } from "react";

export default function TrustDocUploader({ onDone }: { onDone?: () => void }) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    setErr(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trust/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErr(json?.error || "upload_failed");
      } else {
        onDone?.();
      }
    } catch (e) {
      setErr("network_error");
    } finally {
      setPending(false);
      // reset input
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm">
        {pending ? "Uploading..." : "Upload verification doc"}
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={onChange}
          className="hidden"
          disabled={pending}
        />
      </label>
      {err && <span className="text-rose-600 text-sm">{err}</span>}
    </div>
  );
}
