// app/r/[ref]/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Short URL behavior (no DB / no schema change):
 * - Preferred: /r/<anything>?u=<base64url(fullTarget)>&s=<provider_slug>
 *      • u = base64url of the absolute target (https://...)
 *      • s = provider slug (so telemetry can resolve provider_id)
 * - Fallback (legacy): /r/<ref> → redirects to /onboarding?ref=<ref>
 *
 * Telemetry (non-blocking): event = "shortlink.opened"
 * source = { medium:"short", path:"<this_short_url>", provider_slug:"<s or ref>" }
 */
export async function GET(req: Request, ctx: any) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";

  const url = new URL(req.url);
  const ref = ctx?.params?.ref || "";

  // Try short-link mode first: u=<base64url(fullTarget)>
  const u = url.searchParams.get("u") || "";
  const providerSlug =
    url.searchParams.get("s") ||
    url.searchParams.get("slug") ||
    ref ||
    "";

  let target = "";

  if (u) {
    // base64url decode without padding
    try {
      const pad = u.length % 4 === 2 ? "==" : u.length % 4 === 3 ? "=" : "";
      const decoded = Buffer.from(u + pad, "base64url").toString("utf8");
      // basic safety: only allow http(s) absolute targets
      if (/^https?:\/\//i.test(decoded)) {
        target = decoded;
      }
    } catch {
      // ignore decode errors; fall through to legacy path
    }
  }

  // Legacy fallback: referral visit to onboarding if target not set
  if (!target) {
    target = `${base}/onboarding?ref=${encodeURIComponent(ref)}`;
  }

  // Best-effort event log; never block redirect
  try {
    await fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "shortlink.opened",
        // ts omitted → server assigns Date.now(); provider_id resolved from provider_slug
        source: {
          medium: "short",
          path: url.toString(),
          provider_slug: providerSlug,
        },
      }),
      cache: "no-store",
    });
  } catch {
    // never block redirect on logging errors
  }

  // Use 307 to preserve method for POST-able use-cases if needed later
  return NextResponse.redirect(target, { status: 307 });
}
