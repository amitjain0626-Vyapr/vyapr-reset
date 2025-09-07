// app/r/[ref]/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: any) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";

  const ref = ctx?.params?.ref || "";
  const target = `${base}/onboarding?ref=${encodeURIComponent(ref)}`;

  // Best-effort event log; never block redirect
  try {
    await fetch(`${base}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "referral.visit",
        provider_slug: ref,
        source: { medium: "referral", path: `${base}/r/${ref}` },
      }),
      cache: "no-store",
    });
  } catch {}

  return NextResponse.redirect(target, { status: 307 });
}
