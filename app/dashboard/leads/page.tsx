// @ts-nocheck
// app/dashboard/leads/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";         // keep Node runtime (session cookies)
export const dynamic = "force-dynamic";  // never cache; dashboard must be fresh

type LeadRow = {
  id: string;
  created_at: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  provider_id: string;
  source: any | null; // expected shape: { utm?: { source?: string, medium?: string, campaign?: string, term?: string, content?: string }, ref?: string }
};

function UtmChip({ source }: { source: any }) {
  const utm = source?.utm || {};
  const parts: string[] = [];
  if (utm.source) parts.push(`src:${utm.source}`);
  if (utm.medium) parts.push(`med:${utm.medium}`);
  if (utm.campaign) parts.push(`cmp:${utm.campaign}`);
  const label = parts.length ? parts.join(" · ") : (source?.ref ? `ref:${source.ref}` : "direct");
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {label}
    </span>
  );
}

function CellMuted({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-neutral-600">{children}</div>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="font-medium">{children}</div>;
}

export default async function LeadsPage() {
  // SSR Supabase client bound to request cookies/headers
  const cookieStore = cookies();
  const hdrs = headers();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
      headers: {
        get(name: string) {
          return hdrs.get(name) ?? undefined;
        },
      },
    }
  );

  // Require auth
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    redirect("/login?next=/dashboard/leads");
  }

  // Find all providers owned by this user
  const { data: providers, error: pErr } = await supabase
    .from("Providers")
    .select("id, name, slug, published")
    .eq("owner_id", user.id);

  if (pErr) {
    // Fail-open UX: render empty state with a soft message
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Leads</h1>
        <div className="mt-4 text-sm text-red-600">Could not fetch providers. Try reloading.</div>
      </main>
    );
  }

  const providerIds = (providers || []).map((p: any) => p.id);
  let leads: LeadRow[] = [];

  if (providerIds.length > 0) {
    const { data, error } = await supabase
      .from("Leads")
      .select("id, created_at, patient_name, phone, note, provider_id, source")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) leads = data as unknown as LeadRow[];
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="text-sm text-neutral-500">Newest first • showing {leads.length} </div>
      </div>

      {/* Empty state */}
      {leads.length === 0 ? (
        <div className="rounded-xl border p-8 text-center">
          <div className="text-lg font-medium">No leads yet</div>
          <div className="mt-1 text-sm text-neutral-600">Submit the microsite form to see leads here.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full table-fixed">
            <thead className="bg-neutral-50 text-left">
              <tr className="text-xs uppercase tracking-wide text-neutral-600">
                <th className="p-3 w-[22%]">Person</th>
                <th className="p-3 w-[24%]">Contact</th>
                <th className="p-3">Note</th>
                <th className="p-3 w-[20%]">Source</th>
                <th className="p-3 w-[16%]">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((l) => {
                const created = new Date(l.created_at);
                return (
                  <tr key={l.id} className="align-top hover:bg-neutral-50">
                    <td className="p-3">
                      <Title>{l.patient_name || "—"}</Title>
                      <CellMuted>ID: {l.id.slice(0, 8)}…</CellMuted>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">{l.phone || "—"}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm whitespace-pre-wrap break-words">{l.note || "—"}</div>
                    </td>
                    <td className="p-3">
                      <UtmChip source={l.source} />
                    </td>
                    <td className="p-3">
                      <CellMuted>{created.toLocaleString()}</CellMuted>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Guardrail note */}
      <div className="text-xs text-neutral-500">
        Node runtime enforced. Reads are session-scoped via RLS; unpublished providers do not leak.
      </div>
    </main>
  );
}
