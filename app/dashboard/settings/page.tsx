// app/dashboard/settings/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import SettingsClient from "@/components/dashboard/SettingsClient";

export default async function Page(props: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await props.searchParams;
  const safeSlug = (slug || "").trim();

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading settings…</div>}>
        <SettingsClient slug={safeSlug} />
      </Suspense>

      {/* ---- TRUST: Doc Upload (append-only) ---- */}
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-base font-medium">Trust badge — upload document</h2>
        <p className="text-xs text-gray-500">
          Upload a gov/clinic ID (PDF/JPG/PNG). Once reviewed, your microsite shows
          <span className="font-semibold"> “Verified by Vyapr”</span>.
        </p>

        <form
          action="/api/verification/doc"
          method="post"
          encType="multipart/form-data"
          className="space-y-3"
        >
          <input type="hidden" name="slug" value={safeSlug} />
          <label className="block text-sm">
            Document type
            <select
              name="doc_type"
              className="mt-1 w-full rounded border px-3 py-2"
              defaultValue="aadhaar"
            >
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="clinic_license">Clinic License</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block text-sm">
            File
            <input
              type="file"
              name="file"
              accept=".pdf,image/*"
              className="mt-1 block w-full text-sm"
              required
            />
          </label>

          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
          >
            Upload document
          </button>

          <div className="text-xs text-gray-500">
            Tip: You can check raw status at{" "}
            <a
              className="underline"
              href={`/api/verification/status?slug=${encodeURIComponent(safeSlug)}`}
              target="_blank"
            >
              /api/verification/status
            </a>
            .
          </div>
        </form>
      </section>

      {/* ---- TRUST: Publish → Verified (append-only) ---- */}
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="text-base font-medium">Publish profile</h2>
        <p className="text-xs text-gray-500">
          Make your microsite public and show the <span className="font-semibold">Verified</span> marker after review.
        </p>

        <form action="/api/microsite/publish" method="post" className="space-y-3">
          <input type="hidden" name="slug" value={safeSlug} />
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
          >
            Publish now
          </button>
          <div className="text-xs text-gray-500">
            After publish: <code>/api/providers/{safeSlug}</code> will return your public JSON.
          </div>
        </form>
      </section>

      {/* Toggle: Pay in person */}
      <form
        action="/api/provider/toggle-pay-in-person"
        method="post"
        className="rounded-xl border p-4 space-y-3"
      >
        <input type="hidden" name="slug" value={safeSlug} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" value="1" defaultChecked />
          Allow “Pay in person” option for clients
        </label>
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
        >
          Save
        </button>
      </form>

      {/* Pricing per mode */}
      <form
        action="/api/provider/save-pricing"
        method="post"
        className="rounded-xl border p-4 space-y-3"
      >
        <input type="hidden" name="slug" value={safeSlug} />
        <div className="space-y-2">
          <label className="block text-sm">In-person price (₹)</label>
          <input
            type="number"
            name="in_person"
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., 500"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Phone call price (₹)</label>
          <input
            type="number"
            name="phone"
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., 300"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Google Meet price (₹)</label>
          <input
            type="number"
            name="google_meet"
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., 400"
            min="0"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm"
        >
          Save Pricing
        </button>
        <p className="text-xs text-gray-500">
          Leave blank if you charge the same price for all modes.
        </p>
      </form>
    </main>
  );
}
