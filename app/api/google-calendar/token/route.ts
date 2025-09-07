// app/api/google-calendar/token/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cookie name used by server-side calendar routes
const COOKIE_NAME = "gc_at";

// Common setter
function setTokenCookie(token: string) {
  const jar = cookies();
  // ~30 days
  const maxAge = 60 * 60 * 24 * 30;
  jar.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function clearTokenCookie() {
  const jar = cookies();
  jar.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * GET — idempotent “ensure token in cookie”.
 * - If cookie exists → ok:true.
 * - Else try to read provider_token from Supabase session and set cookie.
 */
export async function GET(req: NextRequest) {
  const jar = cookies();
  const hasCookie = !!jar.get(COOKIE_NAME)?.value;

  if (hasCookie) {
    return NextResponse.json({ ok: true, has_token: true, via: "cookie" });
  }

  // Try to lift token from current Supabase session (if present)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(n: string) {
          return jar.get(n)?.value;
        },
        set(n: string, v: string, opts: any) {
          jar.set({ name: n, value: v, ...opts });
        },
        remove(n: string, opts: any) {
          jar.set({ name: n, value: "", ...opts });
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();
  const session: any = data?.session || null;
  const tok =
    session?.provider_token ||
    session?.provider_access_token ||
    null;

  if (!tok) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
  }

  setTokenCookie(tok);
  return NextResponse.json({ ok: true, has_token: true, via: "session" });
}

/**
 * POST — explicit setter.
 * Body: { token: "ya29...." }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const token = (body?.token || "").trim();

  if (!token) {
    // Also allow POST-without-body to try session, like GET does
    const jar = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(n: string) {
            return jar.get(n)?.value;
          },
          set(n: string, v: string, opts: any) {
            jar.set({ name: n, value: v, ...opts });
          },
          remove(n: string, opts: any) {
            jar.set({ name: n, value: "", ...opts });
          },
        },
      }
    );
    const { data } = await supabase.auth.getSession();
    const session: any = data?.session || null;
    const sessionTok =
      session?.provider_token ||
      session?.provider_access_token ||
      null;
    if (!sessionTok) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 400 });
    }
    setTokenCookie(sessionTok);
    return NextResponse.json({ ok: true, set: true, via: "session" });
  }

  setTokenCookie(token);
  return NextResponse.json({ ok: true, set: true, via: "body" });
}

/**
 * DELETE — clear cookie
 */
export async function DELETE() {
  clearTokenCookie();
  return NextResponse.json({ ok: true, cleared: true });
}
