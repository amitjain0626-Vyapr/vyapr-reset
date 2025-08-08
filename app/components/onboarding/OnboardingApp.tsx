"use client";
// @ts-nocheck

import { useEffect, useState } from "react";

type Dentist = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  slug?: string;
  city?: string;
  state?: string;
  pincode?: string;
  about?: string;
  is_published?: boolean;
  profile_image_url?: string | null;
  clinic_image_url?: string | null;
};

export default function OnboardingApp() {
  const [loading, setLoading] = useState(true);
  const [dentist, setDentist] = useState<Dentist | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dentists/me", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed");
        setDentist(data?.dentist || null);
      } catch (e: any) {
        setErr(e?.message || "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading…</div>;
  if (err) return <div className="text-red-600">✗ {err}</div>;

  if (dentist?.is_published) {
    return (
      <div className="border rounded-2xl p-4">
        <div className="mb-2">Already published.</div>
        {dentist?.slug ? (
          <a className="underline" href={`/d/${dentist.slug}`} target="_blank" rel="noreferrer">
            View microsite
          </a>
        ) : null}
        <div className="mt-3">
          <a className="underline" href="/dashboard">Go to dashboard</a>
        </div>
      </div>
    );
  }

  // Minimal Step‑1 (you already have a richer flow; this shell won’t touch cookies)
  return (
    <div className="border rounded-2xl p-4 space-y-3">
      <div className="text-sm opacity-70">Draft profile</div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-70">Name</div>
          <div className="font-medium">{dentist?.name || "—"}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Slug</div>
          <div className="font-medium">{dentist?.slug || "—"}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">City</div>
          <div className="font-medium">{dentist?.city || "—"}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">State</div>
          <div className="font-medium">{dentist?.state || "—"}</div>
        </div>
      </div>

      <div className="pt-2">
        <a className="underline" href="/onboarding/publish?slug=${dentist?.slug || ""}">
          Go to Publish
        </a>
      </div>
    </div>
  );
}
