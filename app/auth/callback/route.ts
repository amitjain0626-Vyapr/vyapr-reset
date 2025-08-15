// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/onboarding";

  if (!code) {
    url.pathname = "/login";
    return NextResponse.redirect(url, { status: 302 });
  }

  // IMPORTANT: pass the cookies function itself (Next 15)
  const supabase = createRouteHandlerClient({ cookies });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const fail = new URL(url.origin + "/login");
    fail.searchParams.set("reason", "auth_exchange_failed");
    return NextResponse.redirect(fail, { status: 302 });
  }

  return NextResponse.redirect(new URL(url.origin + next), { status: 302 });
}
