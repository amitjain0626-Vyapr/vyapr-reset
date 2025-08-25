// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import RoiTrackerClient from "../../../components/dashboard/RoiTrackerClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import QuickAddLead from "@/components/leads/QuickAddLead";
import LeadsClientTable from "@/components/leads/LeadsClientTable";

type PageProps = { searchParams?: Record<string, string | string[]> };
const getParam = (sp: PageProps["searchParams"], k: string) =>
  Array.isArray(sp?.[k]) ? (sp?.[k]?.[0] ?? "") : (sp?.[k] ?? "");

// IST day bounds -> UTC ms (for Events.ts which stores ms epoch)
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

const STATUS_OPTIONS = ["all", "new", "confirmed", "cancelled", "no_show", "won", "lost"] as const;

export default async function LeadsPage({ searchParams }: PageProps) {
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
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm opacity-80">
          No provider found. Please finish <Link href="/onboarding" className="underline">Onboarding</Link>.
        </p>
      </div>
    );
  }

  // 3) Validate ownership (existing cols only)
  const { data: provider, error: pErr } = await supabase
    .from("Providers")
    .select("id, slug, owner_id, published, display_name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (pErr) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Leads — {slug}</h1>
        <p className="text-sm text-red-600">Error loading provider: {String(pErr.message || pErr)}</p>
      </div>
    );
  }
  if (!provider) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Leads — {slug}</h1>
        <p className="text-sm">This slug isn’t owned by your current login, or it isn’t published.</p>
        <p className="text-xs opacity-70">
          Tip: log in as the owner and publish in <Link href="/onboarding" className="underline">Onboarding</Link>.
        </p>
      </div>
    );
  }

  // 4) Filters (URL-driven)
  const q = String(getParam(searchParams, "q") || "").trim();
  const status = (String(getParam(searchParams, "status") || "all").toLowerCase() as (typeof STATUS_OPTIONS)[number]);
  const sort = (String(getParam(searchParams, "sort") || "newest").toLowerCase() === "oldest" ? "oldest" : "newest");

  // 5) Fetch leads (RLS)
  let sel = supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: sort === "oldest" })
    .limit(200);

  if (status && status !== "all") sel = sel.eq("status", status);
  if (q) sel = sel.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%,note.ilike.%${q}%`);
  const { data: leads, error: lErr } = await sel;

  // 6) Compute badge count:
  //    (a) preferred: Events.event='nudge.suggested' for IST-today (from cron)
  //    (b) fallback: live due = Leads with status=new older than 12h
  const { start: istStartUtcMs, end: istEndUtcMs } = istTodayBoundsUtcMs();

  const { count: suggestedToday } = await supabase
    .from("Events")
    .select("event", { count: "exact", head: true })
    .eq("provider_id", provider.id)
    .eq("event", "nudge.suggested")
    .gte("ts", istStartUtcMs)
    .lt("ts", istEndUtcMs);

  const cutoffISO = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { count: dueCount } = await supabase
    .from("Leads")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", provider.id)
    .eq("status", "new")
    .lt("created_at", cutoffISO);

  const badgeCount =
    typeof suggestedToday === "number" && suggestedToday > 0
      ? suggestedToday
      : (typeof dueCount === "number" ? dueCount : 0);

  const providerLabel = provider.display_name || provider.slug;
  const exportHref = `/api/leads/export?slug=${encodeURIComponent(
    provider.slug
  )}${q ? `&q=${encodeURIComponent(q)}` : ""}${status && status !== "all" ? `&status=${encodeURIComponent(status)}` : ""}&sort=${sort}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header + Nudge Center (with badge) + Quick Add */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/nudges?slug=${encodeURIComponent(provider.slug)}`}
            className="px-3 py-2 border rounded text-sm relative"
            title="See who to nudge on WhatsApp"
          >
            Nudge Center
            {badgeCount > 0 ? (
              <span className="ml-2 inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded-full border">
                {badgeCount}
              </span>
            ) : null}
          </Link>
          <QuickAddLead slug={provider.slug} />
        </div>
      </div>

      {/* Provider context */}
      <div className="text-sm opacity-80">
        Provider: <b>{providerLabel}</b> <span className="opacity-60">({provider.slug})</span>
      </div>

      {/* ROI cards */}
      <RoiTrackerClient />

      {/* Filters bar */}
      <form action="/dashboard/leads" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slug" value={provider.slug} />
        <input
          name="q"
          placeholder="Search name, phone, note…"
          className="px-3 py-2 border rounded w-72"
          defaultValue={q}
        />
        <select name="status" defaultValue={status} className="px-2 py-2 border rounded text-sm">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All Statuses" : s}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className="px-2 py-2 border rounded text-sm">
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
        <button className="px-3 py-2 border rounded text-sm">Apply</button>
        <a href={exportHref} className="ml-auto px-3 py-2 border rounded text-sm">Export CSV</a>
      </form>

      {/* Leads table + selection + bulk bar */}
      {lErr ? (
        <div className="text-sm text-red-600">Error loading leads: {String(lErr.message || lErr)}</div>
      ) : !leads || leads.length === 0 ? (
        <div className="text-sm opacity-80">No leads match your filters.</div>
      ) : (
        <LeadsClientTable
          leads={leads}
          provider={{ id: provider.id, slug: provider.slug, display_name: providerLabel }}
        />
      )}
    </div>
  );
}
