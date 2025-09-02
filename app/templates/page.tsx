// @ts-nocheck
import { Suspense } from "react";
import GalleryClient from "./GalleryClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">🧰 Template Packs</h1>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 text-sm">
            Loading templates…
          </div>
        }
      >
        <GalleryClient />
      </Suspense>
    </main>
  );
}
