// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createSupabaseServerClient } from "@/lib/supabase/server";

function csvesc(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes(`"`)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = String(url.searchParams.get("slug") || "").trim();
    const q = String(url.searchParams.get("q") || "").trim();
    const status = String(url.searchParams.get("status") || "all").toLowerCase();
    const sort = String(url.searchParams.get("sort") || "newest").toLowerCase();

    const supabase = await createSupabaseServerClient();

    // Require login
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

    if (!slug) return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });

    // Ownership check
    const { data: provider } = await supabase
      .from("Providers")
      .select("id, slug, owner_id")
      .eq("slug", slug)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!provider) return NextResponse.json({ ok: false, error: "not_owner_or_not_found" }, { status: 403 });

    // Fetch leads under RLS
    let sel = supabase
      .from("Leads")
      .select("id, patient_name, phone, note, status, created_at")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: sort === "oldest" })
      .limit(5000);

    if (status && status !== "all") sel = sel.eq("status", status);
    if (q) sel = sel.or(`patient_name.ilike.%${q}%,phone.ilike.%${q}%,note.ilike.%${q}%`);

    const { data: leads, error: lErr } = await sel;
    if (lErr) throw lErr;

    const rows = [
      ["id", "patient_name", "phone", "status", "note", "created_at"],
      ...(leads || []).map((l) => [
        l.id,
        l.patient_name ?? "",
        l.phone ?? "",
        l.status ?? "",
        l.note ?? "",
        l.created_at ?? "",
      ]),
    ];

    const csv = rows.map((r) => r.map(csvesc).join(",")).join("\n");
    const fileName = `leads_${provider.slug}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
