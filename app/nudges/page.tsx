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

  // 4) Compute windows (IST is used when formatting in LeadActions; here we filter by UTC timestamps)
  const now = Date.now();
  const twelveHoursAgoISO = new Date(now - 12 * 60 * 60 * 1000).toISOString();

  // 5) Fetch candidates
  const { data: dueReminders, error: rErr } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .eq("status", "new")
    .lt("created_at", twelveHoursAgoISO)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: rebook, error: bErr } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .in("status", ["no_show", "cancelled", "lost"])
    .order("created_at", { ascending: false })
    .limit(200);

  const providerLabel = provider.display_name || provider.slug;

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

      {/* Section 1: Due Reminders */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Due reminders (new ≥ 12h)</h2>
          <span className="text-xs opacity-60">{(dueReminders?.length ?? 0)} candidates</span>
        </div>
        {rErr ? (
          <div className="text-sm text-red-600">Error: {String(rErr.message || rErr)}</div>
        ) : (dueReminders?.length ?? 0) === 0 ? (
          <div className="text-sm opacity-70">No reminder candidates right now.</div>
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
