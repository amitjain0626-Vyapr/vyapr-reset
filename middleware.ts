// middleware.ts — neutralized (no auth redirects)
// Pass-through middleware that never runs for app routes.

import type { NextRequest } from "next/server";

// Do nothing and let the request continue.
export function middleware(_req: NextRequest) {
  return;
}

// Never match anything (so this file is effectively disabled)
export const config = {
  matcher: ["/__never__match__"], // no route will match this
};
