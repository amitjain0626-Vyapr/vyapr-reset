// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import LeadActions from "@/components/leads/LeadActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function QuickLeadsPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const supabase = await createSupabaseServerClient();

  // Require login (uses server-side cookie session)
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  const slug = String(searchParams?.slug || "").trim();
  if (!slug) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Quick Leads</h1>
        <p className="text-sm opacity-80">Add <code>?slug=&lt;your-provider-slug&gt;</code> to the URL.</p>
        <p className="mt-2 text-sm">Example: <code>/dashboard/leads/quick?slug=amitjain0626</code></p>
      </div>
    );
  }

  // Load provider for this slug but only if owned by current user (RLS guardrail)
  const { data: provider, error: pErr } = await supabase
    .from("Providers")
    .select("id, slug, owner_id, published, name, display_name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (pErr) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Quick Leads — {slug}</h1>
        <p className="text-red-600 text-sm">Error loading provider: {String(pErr.message || pErr)}</p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Quick Leads — {slug}</h1>
        <p className="text-sm">Provider not found, not published, or not owned by your current login.</p>
        <p className="text-xs opacity-70 mt-2">
          Tip: Ensure you’re logged in as the email that owns <code>{slug}</code>, and that it’s published in Onboarding.
        </p>
      </div>
    );
  }

  // Fetch latest 50 leads for this provider
  const { data: leads, error: lErr } = await supabase
    .from("Leads")
    .select("id, patient_name, phone, note, status, appointment_at, created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const providerLabel =
    provider.display_name || provider.name || provider.slug || "your provider";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quick Leads — {provider.slug}</h1>
        <Link
          href={`/dashboard/leads?slug=${encodeURIComponent(provider.slug)}`}
          className="text-sm underline"
        >
          Back to full dashboard
        </Link>
      </div>

      {lErr ? (
        <div className="text-red-600 text-sm">Error loading leads: {String(lErr.message || lErr)}</div>
      ) : (leads?.length ?? 0) === 0 ? (
        <div className="text-sm opacity-80">
          No leads yet for <b>{provider.slug}</b>. Submit one and refresh.
          <div className="mt-2 text-xs">
            You can use: <code>curl -s -X POST "$BASE/api/leads/create" -H "Content-Type: application/json" -d '{{"slug":"{provider.slug}","patient_name":"Test","phone":"+919888888888","note":"quick"}}'</code>
          </div>
        </div>
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
              {leads!.map((l) => (
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
