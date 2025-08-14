// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    // Protect app pages, but skip API, auth, static, assets
    "/((?!api|auth|_next|static|.*\\.(?:png|jpg|jpeg|gif|svg|ico)|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}
