// app/api/templates/preview/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { waReminder, waRebook } from "@/lib/wa/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal lang normalizer; default = en */
type Lang = "en" | "hi" | "hinglish";
function normalizeLangToken(v?: string | null): Lang {
  const t = (v || "").toLowerCase().trim();
  if (t === "hi") return "hi";
  if (t === "hinglish") return "hinglish";
  return "en";
}

/** Build a WA deep link */
function waUrlFor(phone: string | null | undefined, text: string) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(text || "");
  if (!digits) return `https://api.whatsapp.com/send/?text=${msg}&type=phone_number&app_absent=0`;
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${msg}&type=phone_number&app_absent=0`;
}

/**
 * Preview message copy for common templates (collect pending / rebook).
 * GET /api/templates/preview?slug=...&template=collect_pending|rebook&...
 * Optional qs:
 * - lang=en|hi|hinglish
 * - name, provider, phone
 * - amt (for collect_pending)
 * - category, service (for rebook)
 * - link (appended to the message if present)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const slug = (url.searchParams.get("slug") || "").trim();
    const tpl = (url.searchParams.get("template") || "").trim().toLowerCase();
    const lang = normalizeLangToken(url.searchParams.get("lang"));

    const name = (url.searchParams.get("name") || "there").trim();
    const provider = (url.searchParams.get("provider") || "your service provider").trim();
    const phone = (url.searchParams.get("phone") || "").trim();

    const amtRaw = url.searchParams.get("amt");
    const amountINR =
      amtRaw && isFinite(Number(amtRaw)) ? Math.max(0, Math.round(Number(amtRaw))) : undefined;

    const category = (url.searchParams.get("category") || "").trim().toLowerCase() || null;
    const service = (url.searchParams.get("service") || "").trim() || null;

    // Build message text
    let text = "";
    if (tpl === "collect_pending") {
      text = waReminder(
        {
          name,
          provider,
          amountINR,
          category,
          topService: service,
        },
        lang
      );
    } else if (tpl === "rebook") {
      text = waRebook(
        {
          name,
          provider,
          category,
          topService: service,
        },
        lang
      );
    } else {
      return NextResponse.json(
        { ok: false, error: "unknown_template", hint: "Use template=collect_pending or template=rebook" },
        { status: 400 }
      );
    }

    // --- INSERT: append link if provided (no duplicate whatsapp_url) ---
    const link = (url.searchParams.get("link") || "").trim();
    if (link) {
      text = `${text} ${link}`;
    }

    const whatsapp_url = waUrlFor(phone, text);

    return NextResponse.json({
      ok: true,
      slug,
      template: tpl,
      language: lang,
      preview: {
        text,
        whatsapp_url,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
