// app/api/leads/update-status/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json().catch(() => ({}));
    if (!id || !status) return json(400, { ok: false, error: "id and status required" });

    // 1) user + provider (auth cookies)
    const supa = createServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();

    if (userErr || !user) return json(401, { ok: false, error: "Not authenticated" });

    const { data: provider, error: provErr } = await supa
      .from("providers")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .single();

    if (provErr || !provider) return json(404, { ok: false, error: "Provider not found" });

    // 2) verify the lead belongs to this provider (read with anon client is fine)
    const { data: leadRow, error: leadErr } = await supa
      .from("leads")
      .select("id, dentist_id, status")
      .eq("id", id)
      .single();

    if (leadErr || !leadRow) return json(404, { ok: false, error: "Lead not found" });
    if (leadRow.dentist_id !== provider.id) {
      return json(403, { ok: false, error: "Forbidden: lead not owned by you" });
    }

    // 3) update with service-role (bypass RLS) AFTER ownership check
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: updated, error: updErr } = await admin
      .from("leads")
      .update({ status })
      .eq("id", id)
      .eq("dentist_id", provider.id)
      .select("*")
      .single();

    if (updErr) return json(500, { ok: false, error: "Update failed", details: updErr.message });

    return json(200, { ok: true, lead: updated });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Unexpected error" });
  }
}
