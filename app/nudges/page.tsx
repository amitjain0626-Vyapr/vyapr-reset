// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadsClientTable from "@/components/leads/LeadsClientTable";

type PageProps = { searchParams?: Record<string, string | string[]> };
const getParam = (sp: PageProps["searchParams"], k: string) =>
  Array.isArray(sp?.[k]) ? (sp?.[k]?.[0] ?? "") : (sp?.[k] ?? "");

// Parse windows like "m10" (10 minutes) or "h12" (12 hours)
function windowToMs(w: string) {
  const s = (w || "").toLowerCase().trim();
  if (s.startsWith("m")) {
    const n = parseInt(s.slice(1) || "0", 10);
    return Math.max(1, n) * 60 * 1000;
  }
  if (s.startsWith("h")) {
    const n = parseInt(s.slice(1) || "12", 10);
    return Math.max(1, n) * 60 * 60 * 1000;
  }
  // default 12h
  return 12 * 60 * 60 * 1000;
}

export default async function NudgesPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();

  // 1) Require auth
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  // 2) Resolve slug: ?slug=… or first owned
  let slug = String(getParam(searchParams, "slug") || "").trim();
  if (!slug) {
    const { data: firstOwned } = await supabase
      .from("Providers")
      .select("slug")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOwned?.slug) slug = firstOwned.slug;
  }
  if (!slug) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Nudge Center</h1>
        <p className="text-sm opacity-80">
          No provider found. Please finish <Link href="/onboarding" className="underline">Onboarding</Link>.
        </p>
      </div>
    );
  }

  // 3) Validate ownership
  const { data: provider } = await supabase
    .from("Providers")
    .select("id, slug, owner_id, display_name, published")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!provider) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Nudge Center — {slug}</h1>
        <p className="text-sm">This slug isn’t owned by your current login, or it isn’t published.</p>
      </div>
    );
  }

  // 4) Window selection (default 12h; allow test like m10)
  const windowParam = String(getParam(searchParams, "window") || "h12");
  const cutoffISO = new Date(Date.now() - windowToMs(windowParam)).toISOString();
  const providerLabel = provider.display_name || provider.slug;

  // 5) Fetch candidates
  const { data: dueReminders, error: rErr } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .eq("status", "new")
    .lt("created_at", cutoffISO)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: rebook, error: bErr } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .in("status", ["no_show", "cancelled", "lost"])
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nudge Center</h1>
        <Link href={`/dashboard/leads?slug=${encodeURIComponent(provider.slug)}`} className="text-sm underline">
          Back to Leads
        </Link>
      </div>

      <div className="text-sm opacity-80">
        Provider: <b>{providerLabel}</b> <span className="opacity-60">({provider.slug})</span>
      </div>

      {/* Controls */}
      <form action="/dashboard/nudges" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slug" value={provider.slug} />
        <label className="text-sm">Older than</label>
        <select name="window" defaultValue={windowParam} className="px-2 py-2 border rounded text-sm">
          <option value="m10">10 minutes (test)</option>
          <option value="h2">2 hours</option>
          <option value="h6">6 hours</option>
          <option value="h12">12 hours</option>
          <option value="h24">24 hours</option>
        </select>
        <button className="px-3 py-2 border rounded text-sm">Apply</button>
      </form>

      {/* Section 1: Due Reminders */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Due reminders (new ≥ selected window)</h2>
          <span className="text-xs opacity-60">{(dueReminders?.length ?? 0)} candidates</span>
        </div>
        {rErr ? (
          <div className="text-sm text-red-600">Error: {String(rErr.message || rErr)}</div>
        ) : (dueReminders?.length ?? 0) === 0 ? (
          <div className="text-sm opacity-70">No reminder candidates for this window.</div>
        ) : (
          <LeadsClientTable
            leads={dueReminders!}
            provider={{ id: provider.id, slug: provider.slug, display_name: providerLabel }}
          />
        )}
      </div>

      {/* Section 2: Rebooking */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Rebooking candidates</h2>
          <span className="text-xs opacity-60">{(rebook?.length ?? 0)} candidates</span>
        </div>
        {bErr ? (
          <div className="text-sm text-red-600">Error: {String(bErr.message || bErr)}</div>
        ) : (rebook?.length ?? 0) === 0 ? (
          <div className="text-sm opacity-70">No rebooking candidates yet.</div>
        ) : (
          <LeadsClientTable
            leads={rebook!}
            provider={{ id: provider.id, slug: provider.slug, display_name: providerLabel }}
          />
        )}
      </div>
    </div>
  );
}
