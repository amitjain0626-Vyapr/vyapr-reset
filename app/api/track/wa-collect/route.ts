// app/api/track/wa-collect/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Portable base64url encoder: works on Edge (Web APIs) and Node
function b64url(input: string): string {
  try {
    // Edge/web path: TextEncoder + btoa
    const bytes = new TextEncoder().encode(input);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    // @ts-ignore
    const b64 = typeof btoa === "function" ? btoa(bin) : null;
    if (b64) {
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
  } catch {
    // fall through to Node path
  }
  // Node path: Buffer
  // eslint-disable-next-line no-undef
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// build /r/x?u=...&s=... against our BASE
function shortLinkOf(longUrl: string, slug?: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";
  const u = b64url(longUrl);
  const s = slug ? `&s=${encodeURIComponent(slug)}` : "";
  return `${base}/r/x?u=${u}${s}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const provider_id = (searchParams.get("provider_id") || "").trim();
    const phoneRaw = (searchParams.get("phone") || "").trim();
    const textRaw = (searchParams.get("text") || "").trim();

    const utm_source = (searchParams.get("utm_source") || "").trim();
    const utm_medium = (searchParams.get("utm_medium") || "").trim();
    const utm_campaign = (searchParams.get("utm_campaign") || "").trim();
    const tier = (searchParams.get("tier") || "").trim();
    const ref = (searchParams.get("ref") || "").trim();

    // OPTIONAL: long URL to append as a short /r/x
    const linkRaw = (searchParams.get("link") || "").trim();
    const slug =
      (searchParams.get("slug") || searchParams.get("provider_slug") || "").trim();

    const digits = (phoneRaw || "").replace(/[^\d]/g, "");

    // Compose WA message text; append short link when provided
    let composed = textRaw || "";
    if (/^https?:\/\//i.test(linkRaw)) {
      try {
        const short = shortLinkOf(linkRaw, slug || undefined);
        composed = (composed ? `${composed} ` : "") + short;
      } catch {
        // ignore encoding errors; fallback to original text
      }
    }

    const msg = encodeURIComponent(composed);

    // Stable WA endpoint
    const waUrl =
      `https://api.whatsapp.com/send/?phone=${digits}` +
      `&text=${msg}&type=phone_number&app_absent=0`;

    // telemetry (best-effort; strict shape)
    try {
      await admin().from("Events").insert({
        event: "upsell.wa.clicked",
        ts: Date.now(),
        provider_id: provider_id || null,
        lead_id: null,
        source: {
          channel: "wa",
          target: digits,
          utm: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
          tier,
          ref,
        },
      });
    } catch {}

    return NextResponse.redirect(waUrl, 302);
  } catch {
    return NextResponse.redirect("https://api.whatsapp.com/send/", 302);
  }
}
