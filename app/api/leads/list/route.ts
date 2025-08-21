// app/api/leads/list/route.ts
// @ts-nocheck
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  try {
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

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const { data: providers, error: pErr } = await supabase
      .from("Providers")
      .select("id")
      .eq("owner_id", user.id);

    if (pErr) {
      return NextResponse.json({ ok: false, error: "providers_fetch_failed" }, { status: 500 });
    }

    const providerIds = (providers || []).map((p: any) => p.id);
    if (providerIds.length === 0) {
      return NextResponse.json({ ok: true, leads: [] });
    }

    const { data: leads, error: lErr } = await supabase
      .from("Leads")
      .select("id, created_at, patient_name, phone, note, provider_id, source")
      .in("provider_id", providerIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (lErr) {
      return NextResponse.json({ ok: false, error: "leads_fetch_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leads: leads || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
