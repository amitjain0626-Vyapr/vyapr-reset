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

// NOTE: In Next.js 15, `searchParams` may be a Promise.
// We normalize by awaiting if it looks like a Promise.
export default async function VerifiedPage(props: any) {
  const maybePromise = props?.searchParams;
  const sp = (maybePromise && typeof maybePromise.then === "function")
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

  const data = await fetchVerifiedFlat(slug);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Verified Patients</h1>
      <VerifiedContactsCard slug={slug} items={data.items || []} />
    </main>
  );
}
