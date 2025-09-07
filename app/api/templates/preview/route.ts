// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { waReminder, waRebook } from "@/lib/wa/templates";

/**
 * Lightweight WhatsApp text preview builder.
 * No DB writes. Uses lib/wa/templates and returns a WA deeplink.
 *
 * Examples:
 *  /api/templates/preview?slug=amitjain0626&template=collect_pending&amt=1200&lang=en
 *  /api/templates/preview?slug=amitjain0626&template=rebook&category=dentist&service=scaling%20%26%20polishing&lang=hi
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function waUrlFor(phone: string, text: string) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(text || "");
  if (!digits) return `https://api.whatsapp.com/send/?text=${msg}&type=phone_number&app_absent=0`;
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${msg}&type=phone_number&app_absent=0`;
}

type Lang = "en" | "hi" | "hinglish";
function normLang(v?: string | null): Lang {
  const t = (v || "").toLowerCase().trim();
  if (t === "hi") return "hi";
  if (t === "hinglish") return "hinglish";
  return "en";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const slug = (url.searchParams.get("slug") || "").trim(); // optional, for analytics later
  const template = (url.searchParams.get("template") || "collect_pending").trim().toLowerCase();

  // optional context (safe defaults)
  const lang = normLang(url.searchParams.get("lang"));
  const name = url.searchParams.get("name") || "there";
  const provider = url.searchParams.get("provider") || ""; // show only if caller passes
  const phone = url.searchParams.get("phone") || "";
  const category = url.searchParams.get("category") || ""; // e.g., dentist
  const service = url.searchParams.get("service") || "";   // e.g., scaling & polishing
  const ref = url.searchParams.get("ref") || "";
  const amt = Number(url.searchParams.get("amt") || "0") || undefined;

  let text = "";

  if (template === "collect_pending" || template === "collect" || template === "payment") {
    text = waReminder(
      {
        name,
        provider,
        refCode: ref,
        amountINR: amt,
        category,
        topService: service,
      },
      lang
    );
  } else if (template === "rebook" || template === "reactivate") {
    text = waRebook(
      {
        name,
        provider,
        refCode: ref,
        amountINR: undefined,
        category,
        topService: service,
      },
      lang
    );
  } else {
    // Fallback to collect-pending if unknown template key
    text = waReminder({ name, provider, refCode: ref, amountINR: amt, category, topService: service }, lang);
  }

  const whatsapp_url = waUrlFor(phone, text);

  return NextResponse.json({
    ok: true,
    slug,
    template,
    language: lang,
    preview: { text, whatsapp_url },
  });
}
