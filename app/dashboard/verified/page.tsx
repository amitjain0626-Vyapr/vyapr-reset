// app/dashboard/verified/page.tsx
// @ts-nocheck

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import VerifiedContactsCard from "@/components/dashboard/VerifiedContactsCard";

const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app";

async function fetchVerifiedFlat(slug: string) {
  const u = new URL("/api/contacts/verify", ORIGIN);
  u.searchParams.set("slug", slug);
  u.searchParams.set("mode", "flat");
  u.searchParams.set("limit", "100");

  const r = await fetch(u.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => null);
  if (!j?.ok) {
    return { ok: false, error: j?.error || "fetch_failed", items: [] };
  }
  return { ok: true, items: Array.isArray(j.items) ? j.items : [] };
}

async function fetchProviderMeta(slug: string) {
  try {
    const r = await fetch(`${ORIGIN}/api/providers/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return { ok: false, published: null, provider: null };
    return {
      ok: true,
      published: j.provider?.published ?? null,
      provider: j.provider || null,
    };
  } catch {
    return { ok: false, published: null, provider: null };
  }
}

// NOTE: In Next.js 15, `searchParams` may be a Promise.
// We normalize by awaiting if it looks like a Promise.
export default async function VerifiedPage(props: any) {
  const maybePromise = props?.searchParams;
  const sp =
    maybePromise && typeof maybePromise.then === "function"
      ? await maybePromise
      : (maybePromise || {});
  const slug = String(sp?.slug || "").trim();

  if (!slug) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Verified Patients</h1>
        <p className="mt-2 text-sm text-red-600">
          Missing <code>slug</code>. Append{" "}
          <code>?slug=YOUR_PROVIDER_SLUG</code> to the URL.
        </p>
      </main>
    );
  }

  const [data, meta] = await Promise.all([
    fetchVerifiedFlat(slug),
    fetchProviderMeta(slug),
  ]);

  const published =
    typeof meta.published === "boolean" ? meta.published : null;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Verified Patients</h1>

        {/* Machine-checkable publish flag for Contract V2.3 verify */}
        <span
          data-test="publish-status"
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
            published
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-gray-50 text-gray-700 border border-gray-200"
          }`}
          title={
            published
              ? "Microsite is published — public 'Verified' badge is visible"
              : "Microsite not published — public 'Verified' badge is hidden"
          }
        >
          {published ? "published" : "unpublished"}
        </span>
      </div>

      <p className="text-xs text-gray-500">
        The public <strong>Verified</strong> badge on your microsite is
        shown <em>only</em> when <code>Providers.published = true</code>.
      </p>

      <VerifiedContactsCard
        slug={slug}
        items={data.items || []}
        published={!!published}
      />
    </main>
  );
}
