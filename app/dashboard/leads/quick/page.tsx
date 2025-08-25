// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadActions from "@/components/leads/LeadActions";
import { createClient as createSbAdmin } from "@supabase/supabase-js";

/**
 * Robust Leads page:
 * - Accepts ?slug=<provider-slug>
 * - If missing, auto-picks the first provider owned by the logged-in user
 * - Validates ownership with the normal (RLS) server client
 * - After validation, fetches leads with admin client (service role) to avoid
 *   any restrictive RLS policy from hiding rows
 * - Renders a simple, reliable table + your WA Actions
 *
 * Safe: We *only* use admin to read leads AFTER confirming the provider is owned by auth.user.
 */

type PageProps = { searchParams?: Record<string, string | string[]> };

function getSearchParam(sp: PageProps["searchParams"], key: string) {
  const v = sp?.[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();

  // 1) Require login
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  // 2) Resolve provider slug: ?slug=... OR first owned provider
  let slug = String(getSearchParam(searchParams, "slug") || "").trim();

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
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Vyapr — Dashboard</h1>
        <p className="text-sm opacity-80">
          You don’t have a provider yet. Please complete{" "}
          <Link href="/onboarding" className="underline">onboarding</Link> to create your microsite.
        </p>
      </div>
    );
  }

  // 3) Validate ownership with RLS-bound client (only an owner can see this row)
  const { data: provider, error: pErr } = await supabase
    .from("Providers")
    .select("id, slug, owner_id, published, name, display_name")
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
        <p className="text-sm">This slug either doesn’t exist, isn’t published, or isn’t owned by the current login.</p>
        <p className="text-xs opacity-70">
          Tip: Make sure you’re logged in as the owner and the provider is published in{" "}
          <Link href="/onboarding" className="underline">Onboarding</Link>.
        </p>
      </div>
    );
  }

  // 4) Fetch leads using admin client AFTER ownership validation (bypasses restrictive RLS)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const admin = createSbAdmin(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // NOTE: We only fetch leads for provider.id verified above as owned by the session user.
  const { data: leads, error: lErr } = await admin
    .from("Leads")
    .select("id, patient_name, phone, note, status, appointment_at, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // 5) Render
  const providerLabel = provider.display_name || provider.name || provider.slug || "your provider";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vyapr — Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/leads?slug=${encodeURIComponent(provider.slug)}`}
            className="px-3 py-1.5 text-sm border rounded"
          >
            Leads
          </Link>
          <Link
            href={`/dashboard/payments?slug=${encodeURIComponent(provider.slug)}`}
            className="px-3 py-1.5 text-sm border rounded"
          >
            Payments
          </Link>
        </div>
      </div>

      {/* Minimal header context */}
      <div className="text-sm opacity-80">
        Provider: <b>{providerLabel}</b> <span className="opacity-60">({provider.slug})</span>
      </div>

      {/* Filters row (kept simple for now; we’ll do the full tidy in 13.UX1) */}
      <div className="flex flex-wrap items-center gap-2">
        <form action="/dashboard/leads" method="get" className="flex items-center gap-2">
          <input
            type="hidden"
            name="slug"
            value={provider.slug}
          />
          <input
            name="q"
            placeholder="Search name, phone, note…"
            className="px-3 py-2 border rounded w-72"
            defaultValue={getSearchParam(searchParams, "q")}
          />
          <button className="px-3 py-2 border rounded text-sm">Search</button>
        </form>
        <span className="text-xs opacity-60">Showing latest 50 leads</span>
      </div>

      {/* Leads table */}
      {lErr ? (
        <div className="text-sm text-red-600">Error loading leads: {String(lErr.message || lErr)}</div>
      ) : !leads || leads.length === 0 ? (
        <div className="text-sm opacity-80">No leads yet for <b>{provider.slug}</b>. Add one and refresh.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.patient_name || "Unknown"}</div>
                    {l.note ? <div className="text-xs opacity-70">{l.note}</div> : null}
                  </td>
                  <td className="px-3 py-2">{l.phone || "-"}</td>
                  <td className="px-3 py-2">{l.status || "new"}</td>
                  <td className="px-3 py-2">
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }).format(new Date(l.created_at))}
                  </td>
                  <td className="px-3 py-2">
                    <LeadActions
                      lead={l}
                      provider={{ id: provider.id, display_name: providerLabel, slug: provider.slug }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
