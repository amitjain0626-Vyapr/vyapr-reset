// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import RoiTrackerClient from "../../../components/dashboard/RoiTrackerClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadActions from "@/components/leads/LeadActions";

type PageProps = { searchParams?: Record<string, string | string[]> };
const getParam = (sp: PageProps["searchParams"], k: string) =>
  Array.isArray(sp?.[k]) ? (sp?.[k]?.[0] ?? "") : (sp?.[k] ?? "");

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

  // 3) Validate ownership
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

  // 4) Fetch leads (RLS, stable columns)
  const q = String(getParam(searchParams, "q") || "").trim();
  let sel = supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) sel = sel.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%,note.ilike.%${q}%`);
  const { data: leads, error: lErr } = await sel;

  const providerLabel = provider.display_name || provider.slug;

  return (
    <div className="p-6 space-y-6">
      {/* Single, clean page header (layout already has the top navbar) */}
      <h1 className="text-2xl font-semibold">Leads</h1>

      {/* Provider context */}
      <div className="text-sm opacity-80">
        Provider: <b>{providerLabel}</b> <span className="opacity-60">({provider.slug})</span>
      </div>

      {/* ROI cards (already wired) */}
      <RoiTrackerClient />

      {/* Search (filters bar redux in next step) */}
      <form action="/dashboard/leads" method="get" className="flex items-center gap-2">
        <input type="hidden" name="slug" value={provider.slug} />
        <input name="q" placeholder="Search name, phone, note…" className="px-3 py-2 border rounded w-72" defaultValue={q} />
        <button className="px-3 py-2 border rounded text-sm">Search</button>
        <span className="text-xs opacity-60">Showing latest 50</span>
      </form>

      {/* Leads table with WhatsApp actions */}
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
