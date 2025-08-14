// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    // Protect app pages but skip API, auth, static
    "/((?!api|_next|static|auth|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

export function middleware(req: NextRequest) {
  // Keep your existing logic if any; just ensure we don’t interfere with API cookies.
  return NextResponse.next();
}
