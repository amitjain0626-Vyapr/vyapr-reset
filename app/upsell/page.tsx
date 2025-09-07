// app/upsell/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import BoostCard from "@/components/upsell/BoostCard";
import UpsellViewPing from "@/components/telemetry/UpsellViewPing";
import { createClient } from "@supabase/supabase-js";

/* ---------- Supabase admin (server) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- Types ---------- */
type Provider = { id: string; slug: string; display_name?: string | null } | null;

/* ---------- Safe helpers (never throw) ---------- */
async function getProviderBySlugSafe(slug: string): Promise<Provider> {
  try {
    if (!slug) return null;
    const { data, error } = await admin()
      .from("Providers")
      .select("id, slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data?.id) return null;
    return { id: data.id, slug: data.slug, display_name: data.display_name };
  } catch {
    return null;
  }
}

/* ---------- Page ---------- */
export default async function UpsellPage(props: any) {
  const spRaw = props?.searchParams;
  const searchParams =
    spRaw && typeof spRaw.then === "function" ? await spRaw : spRaw || {};
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";

  const provider = await getProviderBySlugSafe(slug);
  const providerId = provider?.id || null;

  return (
    <main className="p-6 space-y-6">
      {/* client ping for telemetry */}
      <UpsellViewPing slug={slug} providerId={providerId} />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Vyapr Growth — Boost Visibility
          </h1>
          <p className="text-sm text-gray-600">
            Paid discovery slots put your clinic on top of search & directory.
          </p>
        </div>
        {slug ? (
          <div className="text-xs text-gray-500">
            Provider: <code>{provider?.display_name || slug}</code>
          </div>
        ) : null}
      </header>

      {/* Primary Boost CTA */}
      <BoostCard providerId={providerId} slug={slug} />

      {/* Simple FAQ / copy */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">How Boost works</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>Priority placement in Vyapr directory and search.</li>
          <li>Best-performing templates unlocked for reminders &amp; offers.</li>
          <li>Cancel anytime. You only pay for the current cycle.</li>
        </ul>
      </section>
    </main>
  );
}
