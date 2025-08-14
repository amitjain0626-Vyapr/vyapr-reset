// middleware.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export default function middleware() {
  // Allow everything through for diagnosis.
  return NextResponse.next();
}

// Match all routes except Next.js internals & static files
export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
