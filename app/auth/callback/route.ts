// app/auth/callback/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = (url.searchParams.get("token_hash") || "").toString();
  const type = (url.searchParams.get("type") || "magiclink").toString();
  const code = (url.searchParams.get("code") || "").toString();
  const next = url.searchParams.get("next") || "/dashboard/leads";

  const supabase = createClient();

  // 1) Magic link / OTP
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any, // "magiclink" | "signup" | "recovery" | ...
      token_hash,
    });
    if (error) {
      const to = new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin);
      return NextResponse.redirect(to, 302);
    }
    const to = new URL(next.startsWith("/") ? next : `/${next}`, url.origin);
    return NextResponse.redirect(to, 302);
  }

  // 2) OAuth / PKCE (if used)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const to = new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin);
      return NextResponse.redirect(to, 302);
    }
    const to = new URL(next.startsWith("/") ? next : `/${next}`, url.origin);
    return NextResponse.redirect(to, 302);
  }

  // 3) Fallback
  return NextResponse.redirect(new URL("/login", url.origin), 302);
}
