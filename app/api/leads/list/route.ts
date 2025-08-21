// app/api/leads/list/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function noStore(json: any, status = 200) {
  const res = NextResponse.json(json, { status });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const hdrs = headers();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { get: (n: string) => cookieStore.get(n)?.value },
        headers: { get: (n: string) => hdrs.get(n) ?? undefined },
      }
    );

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return noStore({ ok: false, error: "not_authenticated" }, 401);

    const { data: providers, error: pErr } = await supabase
      .from("Providers")
      .select("id")
      .eq("owner_id", user.id);

    if (pErr) return noStore({ ok: false, error: "providers_fetch_failed" }, 500);

    const providerIds = (providers || []).map((p: any) => p.id);
    if (providerIds.length === 0) return noStore({ ok: true, leads: [] });

    const { data: leads, error: lErr } = await supabase
      .from("Leads")
      .select("id, created_at, patient_name, phone, note, provider_id, source")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (lErr) return noStore({ ok: false, error: "leads_fetch_failed" }, 500);

    return noStore({ ok: true, leads: leads || [] });
  } catch {
    return noStore({ ok: false, error: "unexpected" }, 500);
  }
}
