// app/r/[ref]/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Short URL behavior (no DB / no schema change):
 * - Preferred: /r/<anything>?uRaw=<https://...>&s=<provider_slug>
 *      • uRaw = absolute target URL (URL-encoded)
 *      • s    = provider slug (so telemetry can resolve provider_id)
 * - Also supported (legacy): u=<base64url(fullTarget)>
 * - Fallback (legacy): /r/<ref> → /onboarding?ref=<ref>
 *
 * Telemetry (non-blocking): event = "shortlink.opened"
 * source = { medium:"short", path:"<this_short_url>", provider_slug:"<s or ref>" }
 */

// portable base64url decoder (kept for backward compatibility)
function decodeBase64UrlSafe(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  try {
    const padLen = (4 - (input.length % 4)) % 4;
    const padded = input + "=".repeat(padLen);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob === "function") {
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    }
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

  // NEW: uRaw (preferred)
  const uRaw = url.searchParams.get("uRaw") || "";
  // Legacy: u = base64url
  const u = url.searchParams.get("u") || "";
  const providerSlug =
    url.searchParams.get("s") ||
    url.searchParams.get("slug") ||
    ref ||
    "";

  let target = "";

  // Prefer uRaw if present and looks like absolute http(s) URL
  if (uRaw && /^https?:\/\//i.test(uRaw)) {
    target = uRaw;
  } else if (u) {
    const decoded = decodeBase64UrlSafe(u);
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
        source: {
          medium: "short",
          path: url.toString(),
          provider_slug: providerSlug,
        },
      }),
      cache: "no-store",
    });
  } catch {}

  return NextResponse.redirect(target, { status: 307 });
}
