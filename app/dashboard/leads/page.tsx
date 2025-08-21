// app/dashboard/leads/page.tsx
// @ts-nocheck
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import LeadsClient from "./LeadsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  created_at: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  provider_id: string;
  source: any | null;
};

export default async function LeadsPage() {
  const cookieStore = cookies();
  const hdrs = headers();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { get(name: string) { return cookieStore.get(name)?.value; } },
      headers: { get(name: string) { return hdrs.get(name) ?? undefined; } },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/dashboard/leads");

  const { data: providers } = await supabase
    .from("Providers")
    .select("id")
    .eq("owner_id", user.id);

  let initial: LeadRow[] = [];
  const providerIds = (providers || []).map((p: any) => p.id);
  if (providerIds.length > 0) {
    const { data } = await supabase
      .from("Leads")
      .select("id, created_at, patient_name, phone, note, provider_id, source")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) initial = data as unknown as LeadRow[];
  }

  return (
    <main className="p-6 space-y-4">
      <LeadsClient initial={initial} />
    </main>
  );
}
