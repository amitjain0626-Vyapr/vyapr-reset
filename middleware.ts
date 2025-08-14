// Completely disable middleware so it never runs.
// This ensures /api routes receive cookies untouched.

// If you had logic here, we'll re-enable after the 401 is gone.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  // Empty matcher => middleware runs for nothing.
  matcher: [] as string[],
};

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}
