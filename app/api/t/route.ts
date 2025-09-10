// app/api/t/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

const PROVIDER_ID_FALLBACKS: Record<string, string> = {
  amitjain0626: "c56d7dac-c9ed-4828-9c52-56a445fce7b3",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const slug = q.get("slug") || "";
  const template_id = q.get("tid") || "offer-basic";
  const audience = q.get("a") || "All";
  const provider_id = PROVIDER_ID_FALLBACKS[slug] || null;

  // If client provided full message, prefer that (supports 100+ categories without server copies)
  const clientMsg = q.get("msg");

  // Log template.opened (best-effort)
  const body = JSON.stringify({
    event: "template.opened",
    ts: Date.now(),
    provider_id, // may be null; DB will enforce rules
    source: {
      provider_slug: slug || null,
      template_id,
      audience,
      placeholders: {
        amount: q.get("amt") || "500",
        count: q.get("cnt") || "5",
        expiryDays: q.get("exp") || "7",
      },
      ua: req.headers.get("user-agent") || "",
    },
  });

  try {
    await fetch(new URL("/api/events/log", url.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {}

  // Centralized brand in default message (no hard-coded Korekko)
  const msg = clientMsg || `Hello! This message was sent via ${BRAND.name}.`;
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  return NextResponse.redirect(wa, { status: 302 });
}
