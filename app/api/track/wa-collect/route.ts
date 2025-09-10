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

// build /r/x?uRaw=...&s=... against our BASE (no base64)
function shortLinkOf(longUrl: string, slug?: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";
  const uRaw = encodeURIComponent(longUrl);
  const s = slug ? `&s=${encodeURIComponent(slug)}` : "";
  return `${base}/r/x?uRaw=${uRaw}${s}`;
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
    const linkParam = (searchParams.get("link") || "").trim();
    const slug =
      (searchParams.get("slug") || searchParams.get("provider_slug") || "").trim();

    const digits = (phoneRaw || "").replace(/[^\d]/g, "");

    // --- FIX: safely decode link (handles links passed as https%3A%2F%2F...) ---
    let linkDecoded = linkParam;
    try {
      // decodeURIComponent is idempotent for non-encoded strings (throws only on malformed)
      linkDecoded = decodeURIComponent(linkParam);
    } catch {
      // keep original if decoding fails
      linkDecoded = linkParam;
    }

    // Compose WA message text; append short link when provided
    let composed = textRaw || "";
    if (/^https?:\/\//i.test(linkDecoded)) {
      try {
        const short = shortLinkOf(linkDecoded, slug || undefined);
        composed = (composed ? `${composed} ` : "") + short;
      } catch {
        // ignore; fallback to original text
      }
    }

    const msg = encodeURIComponent(composed);

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
