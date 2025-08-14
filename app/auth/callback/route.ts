// app/auth/callback/route.ts
// Supabase email magic-link callback (handles both `token_hash` and `code`).
// Next.js 15 Route Handler
// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Map incoming `type` to Supabase verifyOtp types
function normalizeType(t?: string) {
  switch ((t || "").toLowerCase()) {
    case "magiclink":
    case "signup":
    case "recovery":
    case "email_change":
    case "invitation":
    case "invite":
      return t.toLowerCase() === "invite" ? "invitation" : t.toLowerCase();
    default:
      return "magiclink";
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/onboarding";

  const token_hash = url.searchParams.get("token_hash");
  const type = normalizeType(url.searchParams.get("type"));
  const code = url.searchParams.get("code"); // for PKCE/code links (rare on email)

  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // @ts-ignore
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });

  try {
    if (token_hash) {
      // Standard email magic-link path
      const { error } = await supabase.auth.verifyOtp({
        type: type as any, // 'magiclink' | 'signup' | 'recovery' | 'email_change' | 'invitation'
        token_hash,
      });
      if (error) throw error;
    } else if (code) {
      // Fallback: some flows may send a `code`
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      // Nothing to process — bounce to login
      const bounce = new URL("/login", url);
      bounce.searchParams.set("error", "invalid_callback");
      bounce.searchParams.set("next", next);
      return NextResponse.redirect(bounce, { status: 303 });
    }

    // Success ⇒ go to intended page
    const dest = new URL(next, url);
    return NextResponse.redirect(dest, { status: 303 });
  } catch (e: any) {
    const bounce = new URL("/login", url);
    bounce.searchParams.set("error", e?.message || "auth_failed");
    bounce.searchParams.set("next", next);
    return NextResponse.redirect(bounce, { status: 303 });
  }
}
