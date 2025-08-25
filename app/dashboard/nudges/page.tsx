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
  if (s.startsWith("m")) return Math.max(1, parseInt(s.slice(1) || "0", 10)) * 60 * 1000;
  if (s.startsWith("h")) return Math.max(1, parseInt(s.slice(1) || "12", 10)) * 60 * 60 * 1000;
  return 12 * 60 * 60 * 1000; // default 12h
}

// IST start/end of today → UTC ms to compare against Events.ts (ms epoch)
function istTodayBoundsUtcMs(): { start: number; end: number } {
  const IST_OFFSET = 330 * 60 * 1000; // +05:30
  const nowUtc = Date.now();
  const nowIstMs = nowUtc + IST_OFFSET; // shift to IST
  const istNow = new Date(nowIstMs);
  const startIstLocalAsUtc = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
    0, 0, 0
  );
  const startUtcMs = startIstLocalAsUtc - IST_OFFSET; // shift back to UTC ms
  return { start: startUtcMs, end: startUtcMs + 24 * 60 * 60 * 1000 };
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

  const providerLabel = provider.display_name || provider.slug;

  // 4) “Older than” window (for Due Reminders section)
  const windowParam = String(getParam(searchParams, "window") || "h12");
  const cutoffISO = new Date(Date.now() - windowToMs(windowParam)).toISOString();

  // 5) Fetch candidates (live)
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

  // 6) Suggested today (from Events table) — IST day bounds
  const { start: istStartUtcMs, end: istEndUtcMs } = istTodayBoundsUtcMs();
  const { count: suggestedToday } = await supabase
    .from("Events")
    .select("event", { count: "exact", head: true })
    .eq("provider_id", provider.id)
    .eq("event", "nudge.suggested")
    .gte("ts", istStartUtcMs)
    .lt("ts", istEndUtcMs);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nudge Center</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/leads?slug=${encodeURIComponent(provider.slug)}`}
            className="text-sm underline"
          >
            Back to Leads
          </Link>
          <span className="text-xs px-2 py-1 border rounded-full">
            Suggested today: <b>{typeof suggestedToday === "number" ? suggestedToday : 0}</b>
          </span>
        </div>
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
