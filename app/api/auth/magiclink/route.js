// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getBaseUrl(req) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function readFormOrJson(req) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) return (await req.json().catch(() => ({}))) || {};
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData().catch(() => null);
    const o = {};
    if (form) for (const [k, v] of form.entries()) o[k] = typeof v === "string" ? v : "";
    return o;
  }
  return {};
}

export async function POST(req) {
  try {
    const body = await readFormOrJson(req);
    const email = (body.email || "").trim();
    const debug = !!body.debug;
    if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

    const base = getBaseUrl(req);
    const params = new URLSearchParams({ next: "/dashboard" });
    if (debug) params.set("debug", "1");
    const redirectTo = `${base}/auth/callback?${params.toString()}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, redirectTo });
  } catch {
    return NextResponse.json({ ok: false, error: "unexpected error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/auth/magiclink" });
}
