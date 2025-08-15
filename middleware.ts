// @ts-nocheck
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

/**
 * Safe middleware:
 * - Skips /api, /_next, /static, /public assets, favicon, images
 * - Skips /auth/* for Supabase callback/magic link
 * - Runs only on relevant app routes (e.g., dashboard, onboarding)
 *
 * Purpose:
 * - Ensures server knows the current auth session
 * - Redirects unauthenticated users away from protected pages
 */

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip all API routes, static files, and images
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp)$/) ||
    pathname.startsWith("/auth")
  ) {
    return res;
  }

  // Create Supabase client (uses cookies to get session)
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect specific routes — adjust as needed
  const protectedPaths = ["/dashboard", "/onboarding", "/inbox"];
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtected && !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

/**
 * Matcher: Only run on non-API, non-static paths.
 * Regex explanation:
 *  - Negative lookahead for paths starting with api, _next, static, auth, or asset extensions
 */
export const config = {
  matcher: [
    "/((?!api|_next|static|auth|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
