// app/api/saved-views/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies(); // Next 15
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

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) return bad(401, "Not authenticated");

  const { data, error } = await supabase
    .from("SavedViews")
    .select("id, name, params, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return bad(500, error.message);
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) return bad(401, "Not authenticated");

  const body = await req.json().catch(() => null);
  const name = (body?.name || "").toString().trim();
  const params = body?.params;

  if (!name || name.length > 80) return bad(400, "Invalid name");
  if (!params || typeof params !== "object") return bad(400, "Invalid params");

  const row = {
    user_id: ures.user.id,
    name,
    params, // expect { q?: string, range: "ALL"|"TODAY"|"7D"|"30D", from?: string, to?: string }
  };

  const { data, error } = await supabase
    .from("SavedViews")
    .insert(row)
    .select("id, name, params, created_at")
    .single();

  if (error) return bad(500, error.message);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
