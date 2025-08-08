// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

export default function PublishPage() {
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    // try read slug from URL (?slug=)
    const url = new URL(window.location.href);
    const s = (url.searchParams.get("slug") || "").toLowerCase();
    if (s) setSlug(s);
  }, []);

  const publish = async () => {
    setStatus("busy");
    setMsg("");
    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setStatus("ok");
      setMsg("Published. Redirecting…");
      setTimeout(() => {
        window.location.href = data?.micrositePath || "/";
      }, 800);
    } catch (e: any) {
      setStatus("err");
      setMsg(e?.message || "Something went wrong");
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Publish Microsite</h1>
      <p className="text-sm text-gray-600 mb-6">
        Finalize your vanity URL and go live.
      </p>

      <label className="block text-sm mb-1">Slug</label>
      <div className="flex gap-2 mb-4">
        <span className="inline-flex items-center px-3 border rounded-xl border-r-0">/d/</span>
        <input
          className="w-full border rounded-xl px-3 py-2"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="dr-amit-jain"
        />
      </div>

      <button
        onClick={publish}
        disabled={!slug || status === "busy"}
        className="px-4 py-2 rounded-xl border"
      >
        {status === "busy" ? "Publishing…" : "Publish Now"}
      </button>

      {msg ? (
        <div className={`mt-3 text-sm ${status === "err" ? "text-red-600" : ""}`}>
          {msg}
        </div>
      ) : null}
    </main>
  );
}
