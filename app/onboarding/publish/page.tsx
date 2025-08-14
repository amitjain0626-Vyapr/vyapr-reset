// @ts-nocheck
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PublishButton({ payload }: { payload: any }) {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onPublish() {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // IMPORTANT: include credentials so the API sees the session cookie
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const message =
          json?.error?.message ||
          `Publish failed (${res.status}). Please try again.`;
        setErrMsg(message);
        setLoading(false);
        return;
      }
      // Success: redirect to dashboard
      router.push(json.redirect || `/dashboard?slug=${json.slug}`);
    } catch (e: any) {
      setErrMsg(e?.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onPublish}
        disabled={loading}
        className="rounded-2xl px-4 py-2 bg-black text-white"
      >
        {loading ? "Publishing…" : "Publish"}
      </button>
      {errMsg && (
        <div className="text-sm text-red-600 border border-red-200 rounded-md p-2 bg-red-50">
          {errMsg}
        </div>
      )}
    </div>
  );
}