// app/api/verification/file/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = String(searchParams.get("path") || "").trim();
    if (!path) {
      return NextResponse.json({ ok: false, error: "missing_path" }, { status: 400 });
    }
    const sb = admin();
    const { data, error } = await sb.storage.from("verification").createSignedUrl(path, 60 * 10); // 10 min
    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: false, error: error?.message || "sign_failed" }, { status: 500 });
    }
    return NextResponse.redirect(data.signedUrl);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
