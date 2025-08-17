// app/api/leads/list/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// ✅ ensure cookies are read per-request (no static cache / revalidate)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * GET /api/leads/list?q=&status=&from=&to=&limit=&offset=
 * Uses logged-in session (RLS). Returns leads for providers owned by the user.
 * No slug required.
 */
export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    // auth via RLS (must see the cookie on each request)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // provider ids owned by this user
    const { data: providers, error: provErr } = await supabase
      .from("providers")
      .select("id")
      .eq("owner_id", user.id);

    if (provErr) {
      return NextResponse.json(
        { ok: false, error: "Failed to load providers", details: provErr.message },
        { status: 500 }
      );
    }

    const providerIds = (providers || []).map((p) => p.id);
    if (providerIds.length === 0) {
      return NextResponse.json({ ok: true, rows: [], total: 0 }, { status: 200 });
    }

    // base query
    let query = supabase
      .from("leads")
      .select(
        "id, patient_name, phone, status, source, created_at, note, source_slug, dentist_id",
        { count: "exact" }
      )
      .in("dentist_id", providerIds)
      .order("created_at", { ascending: false });

    // filters
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("created_at", new Date(from).toISOString());
    if (to) query = query.lte("created_at", new Date(to).toISOString());

    // search
    if (q) {
      const nameTry = await query.ilike("patient_name", `%${q}%`).range(offset, offset + limit - 1);
      if (nameTry.error) {
        return NextResponse.json({ ok: false, error: "Search failed", details: nameTry.error.message }, { status: 500 });
      }
      if ((nameTry.data || []).length > 0) {
        return NextResponse.json({ ok: true, rows: nameTry.data || [], total: nameTry.count || 0 }, { status: 200 });
      }
      const phoneTry = await query.ilike("phone", `%${q}%`).range(offset, offset + limit - 1);
      if (phoneTry.error) {
        return NextResponse.json({ ok: false, error: "Search failed", details: phoneTry.error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, rows: phoneTry.data || [], total: phoneTry.count || 0 }, { status: 200 });
    }

    // pagination
    const { data: rows, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      return NextResponse.json({ ok: false, error: "Query failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rows: rows || [], total: count || 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Server error", details: e?.message || String(e) }, { status: 500 });
  }
}
