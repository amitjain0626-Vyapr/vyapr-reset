// app/auth/callback/route.ts
// Supabase magic-link callback with smart redirect:
// - If provider profile with slug exists => /dashboard?slug=<slug>
// - Else => /onboarding
// Handles both `token_hash` (magic link) and `code` (PKCE).
// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function isSafePath(p?: string | null) {
  if (!p) return false;
  try {
    // Only allow same-origin relative paths
    const u = new URL(p, "http://local");
    return u.origin === "http://local" && u.pathname.startsWith("/");
  } catch {
    return false;
  }
}

function normalizeType(t?: string) {
  const x = (t || "").toLowerCase();
  if (x === "invite") return "invitation";
  return ["magiclink", "signup", "recovery", "email_change", "invitation"].includes(x)
    ? x
    : "magiclink";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qpNext = url.searchParams.get("next"); // caller's hint (optional)
  const token_hash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const type = normalizeType(url.searchParams.get("type"));

  // Supabase server client with cookie adapter
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
    // 1) Complete auth
    if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash });
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      const bounce = new URL("/login", url);
      bounce.searchParams.set("error", "invalid_callback");
      return NextResponse.redirect(bounce, { status: 303 });
    }

    // 2) Who just signed in?
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      const bounce = new URL("/login", url);
      bounce.searchParams.set("error", "no_user");
      return NextResponse.redirect(bounce, { status: 303 });
    }

    // 3) Do they already have a Provider profile with slug?
    //    Adjust table/column names if yours differ.
    const { data: provider, error: provErr } = await supabase
      .from("Providers")
      .select("slug")
      .eq("owner_id", user.id)
      .is("deleted_at", null) // safe if you soft-delete; ignore if not used
      .limit(1)
      .maybeSingle();

    // 4) Decide destination
    // Priority:
    //  a) If provider exists with slug => dashboard for that slug
    //  b) Else => onboarding
    //  c) If a safe `next` is provided AND user has no slug dependency, you can honor it.
    let destPath: string;

    if (provider?.slug) {
      destPath = `/dashboard?slug=${encodeURIComponent(provider.slug)}`;
    } else {
      destPath = "/onboarding";
    }

    // If caller passed a *safe* next, and it’s not obviously conflicting with slug logic,
    // you can optionally honor it. We’ll only override when there is a slug and next
    // points to onboarding—common case after first setup.
    if (isSafePath(qpNext)) {
      const nextUrl = new URL(qpNext!, "http://local");
      const wantsOnboarding = nextUrl.pathname === "/onboarding";
      if (!provider?.slug && !wantsOnboarding) {
        // No slug yet and caller wants a non-onboarding path → keep our default (onboarding)
      } else if (provider?.slug && wantsOnboarding) {
        // Already has slug but caller asked onboarding (likely stale link) → prefer dashboard
      } else {
        destPath = nextUrl.pathname + (nextUrl.search || "");
      }
    }

    // 5) Redirect
    const dest = new URL(destPath, url);
    return NextResponse.redirect(dest, { status: 303 });
  } catch (e: any) {
    const bounce = new URL("/login", url);
    bounce.searchParams.set("error", e?.message || "auth_failed");
    if (isSafePath(qpNext)) bounce.searchParams.set("next", qpNext!);
    return NextResponse.redirect(bounce, { status: 303 });
  }
}
