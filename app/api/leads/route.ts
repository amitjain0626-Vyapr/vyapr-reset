export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Helpers -------------------------------------------------------------
function ok(body: any, init: number = 200) {
  return NextResponse.json({ ok: true, ...body }, { status: init });
}
function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function encodeCursor(cur: { created_at: string; id: string }) {
  return Buffer.from(JSON.stringify(cur)).toString("base64url");
}
function decodeCursor(raw: string | null) {
  if (!raw) return null;
  try {
    if (raw.includes("|")) {
      const [created_at, id] = raw.split("|");
      if (!created_at || !id) return null;
      return { created_at, id };
    }
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const v = JSON.parse(json);
    if (typeof v?.created_at === "string" && typeof v?.id === "string") {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

// Authenticated Supabase (RLS applies) -------------------------------
function getSupabase() {
  const cookieStore = cookies();
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

// GET /api/leads?limit=20&cursor=<base64>|<iso|uuid>&query=<text>
export async function GET(req: NextRequest) {
  const supabase = getSupabase();

  // Require login
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return err(401, "Not authenticated");
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = clamp(isNaN(limitParam) ? 20 : limitParam, 1, 100);

  const rawCursor = url.searchParams.get("cursor");
  const queryText = (url.searchParams.get("query") || "").trim();

  const cursor = decodeCursor(rawCursor);

  // Base select: rely on RLS so only the logged-in provider's rows are visible.
  // Stable order: created_at DESC, id DESC
  let q = supabase
    .from("Leads")
    .select("id, created_at, patient_name, phone, note, provider_id", { count: "exact", head: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  // Seek pagination using (created_at, id)
  if (cursor?.created_at && cursor?.id) {
    // For DESC order, fetch rows strictly after the cursor
    q = q.or(
      `and(created_at.lt.${cursor.created_at}),and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  // Lightweight search across name/phone
  if (queryText) {
    const escaped = queryText.replace(/[%_]/g, "\\$&");
    q = q.or(`patient_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  // Fetch limit+1 to know if there's another page
  const { data, error } = await q.limit(limit + 1);

  if (error) {
    return err(500, `Query failed: ${error.message}`);
  }

  const has_more = (data?.length || 0) > limit;
  const page = has_more ? data!.slice(0, limit) : data!;

  const next_cursor = has_more
    ? encodeCursor({ created_at: page[page.length - 1].created_at, id: page[page.length - 1].id })
    : null;

  return ok({
    data: page,
    next_cursor,
    has_more,
  });
}