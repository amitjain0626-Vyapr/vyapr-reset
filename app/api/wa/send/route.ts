// app/api/wa/send/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/wa/send
 * Query:
 *   phone=+9199...   (required; E.164 or digits)
 *   text=...         (required; message to prefill)
 *   provider_id=...  (optional)
 *   lead_id=...      (optional)
 *   ref=reminder|rebook|...  (optional; defaults to "reminder")
 *
 * Behavior:
 *   - Normalizes phone to digits
 *   - Redirects 302 to https://api.whatsapp.com/send/?phone=<digits>&text=<encoded>
 *   - Logs telemetry with strict shape:
 *       {event, ts, provider_id, lead_id, source:{channel:"wa", target:"<digits>", ref, tone:"veli"}}
 *     Event name:
 *       ref=reminder → "wa.reminder.sent.veli"
 *       ref=rebook   → "wa.rebook.sent.veli"
 *       else         → "wa.message.sent.veli"
 */

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function digitsOnly(raw?: string | null) {
  return (raw || "").toString().replace(/[^\d]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const phoneRaw = searchParams.get("phone") || "";
    const textRaw = searchParams.get("text") || "";
    const provider_id = (searchParams.get("provider_id") || "").trim() || null;
    const lead_id = (searchParams.get("lead_id") || "").trim() || null;
    const ref = (searchParams.get("ref") || "reminder").trim().toLowerCase();

    const digits = digitsOnly(phoneRaw);
    const msg = encodeURIComponent(textRaw);

    if (!digits || !textRaw) {
      return NextResponse.json({ ok: false, error: "missing_phone_or_text" }, { status: 400 });
    }

    // Event name by ref (Veli tone variants)
    let event = "wa.message.sent.veli";
    if (ref === "reminder") event = "wa.reminder.sent.veli";
    else if (ref === "rebook") event = "wa.rebook.sent.veli";

    // Best-practice WA URL variant
    const waUrl =
      `https://api.whatsapp.com/send/?phone=${digits}` +
      `&text=${msg}&type=phone_number&app_absent=0`;

    // Fire-and-forget telemetry (strict shape)
    try {
      await admin().from("Events").insert({
        event,
        ts: Date.now(),
        provider_id,
        lead_id,
        source: { channel: "wa", target: digits, ref, tone: "veli" },
      });
    } catch {
      // ignore
    }

    return NextResponse.redirect(waUrl, 302);
  } catch {
    return NextResponse.redirect("https://api.whatsapp.com/send/", 302);
  }
}
