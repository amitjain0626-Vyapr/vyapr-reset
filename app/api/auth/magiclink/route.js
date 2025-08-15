// No TypeScript here. Pure JS.
// Forces Node runtime (supabase-js is safer on Node than Edge for this route)
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
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    return j || {};
  }
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData().catch(() => null);
    if (!form) return {};
    const obj = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : "";
    return obj;
  }
  return {};
}

export async function POST(req) {
  try {
    const body = await readFormOrJson(req);
    const email = (body.email || "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }

    const base = getBaseUrl(req);
    const redirectTo = `${base}/auth/callback`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, redirectTo });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "unexpected error" }, { status: 500 });
  }
}

export async function GET() {
  // Optional: simple ping for health checks
  return NextResponse.json({ ok: true, route: "auth/magiclink" });
}
