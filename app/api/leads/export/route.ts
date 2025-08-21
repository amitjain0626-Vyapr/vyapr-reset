// app/api/leads/export/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies(); // Next 15: cookies() is async in route handlers
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, expires: new Date(0) });
        },
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabase();

  // Auth required (RLS will also apply)
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const url = new URL(req.url);
  const queryText = (url.searchParams.get("query") || "").trim();
  const from = (url.searchParams.get("from") || "").trim(); // ISO datetime
  const to = (url.searchParams.get("to") || "").trim();     // ISO datetime

  // Base query; provider scoping is enforced by RLS
  let q = supabase
    .from("Leads")
    .select("id, created_at, patient_name, phone, note", { head: false })
    .order("created_at", { ascending: false });

  // Date range
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  // Search across name/phone
  if (queryText) {
    const escaped = queryText.replace(/[%_]/g, "\\$&");
    q = q.or(`patient_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data, error } = await q;

  if (error) {
    return new Response("Query failed: " + error.message, { status: 500 });
  }

  // Build CSV safely (double-quote + escape internal quotes)
  const header = ["id", "created_at", "patient_name", "phone", "note"];
  const body = (data || []).map((r) =>
    [
      r.id,
      r.created_at,
      `"${(r.patient_name || "").replace(/"/g, '""')}"`,
      `"${(r.phone || "").replace(/"/g, '""')}"`,
      `"${(r.note || "").replace(/"/g, '""')}"`,
    ].join(",")
  );
  const csv = [header.join(","), ...body].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
