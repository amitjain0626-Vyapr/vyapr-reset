// app/r/[ref]/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";          // ← INSERT: ensure Node runtime (Buffer available)
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

// INSERT: portable base64url decoder (Edge/Node safe, no throw)
function decodeBase64UrlSafe(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  try {
    // add missing padding for base64url
    const padLen = (4 - (input.length % 4)) % 4;
    const padded = input + "=".repeat(padLen);
    // replace url-safe chars with standard base64
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");

    // Prefer Web API atob (Edge), else Buffer (Node)
    if (typeof atob === "function") {
      const bin = atob(b64);
      // convert binary string to UTF-8
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    }
    // Node path
    // eslint-disable-next-line no-undef
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

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
    const decoded = decodeBase64UrlSafe(u);      // ← INSERT: robust decoding
    if (decoded && /^https?:\/\//i.test(decoded)) {
      target = decoded;
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
