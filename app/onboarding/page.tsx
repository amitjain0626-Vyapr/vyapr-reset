// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Helper: never render objects directly
function toText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export default function OnboardingPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [slug, setSlug] = useState("");
  const [publish, setPublish] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | { code?: any; message?: any; details?: any }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, phone, city, category, slug, publish }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        const err = json?.error || { code: "unknown", message: "Unexpected error" };
        setError({
          code: toText(err.code),
          message: toText(err.message),
          details: err.details,
        });
        setSubmitting(false);
        return;
      }

      const dest = json.redirectTo || `/dashboard?slug=${json.slug}`;
      router.push(dest);
    } catch (e: any) {
      setError({
        code: "network_error",
        message: toText(e?.message || e),
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Create your Vyapr microsite</h1>
      <p className="text-sm text-gray-600 mb-6">VYAPR-ONBOARDING-V4</p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-medium text-red-700">
            {toText(error.code)}: {toText(error.message)}
          </div>
          {error.details ? (
            <pre className="mt-2 whitespace-pre-wrap text-red-700/80 text-xs">
              {toText(error.details)}
            </pre>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chic"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Phone</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91XXXXXXXXXX"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">City (optional)</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Indore"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Category</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Yoga"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Slug (optional)</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="your-handle"
          />
          <p className="mt-1 text-xs text-gray-500">Final link will be /d/&lt;slug&gt;</p>
        </div>

        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          <span className="text-sm">Publish</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? "Publishing…" : "Publish"}
        </button>
      </form>
    </div>
  );
}
