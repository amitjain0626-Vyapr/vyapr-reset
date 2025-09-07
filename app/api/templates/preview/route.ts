// app/api/templates/preview/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { waReminder, waRebook } from "@/lib/wa/templates";

/* ... existing helpers unchanged ... */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const tpl = (url.searchParams.get("template") || "").trim();
  const lang = (url.searchParams.get("lang") || "en").toLowerCase();
  const amt = url.searchParams.get("amt");
  const cat = url.searchParams.get("category") || "";
  const svc = url.searchParams.get("service") || "";
  const phone = url.searchParams.get("phone") || "";
  const name = url.searchParams.get("name") || "";
  const provider = url.searchParams.get("provider") || "";

  let text = "";
  if (tpl === "collect_pending") {
    text = waReminder(
      { name, provider, amountINR: amt ? Number(amt) : undefined, category: cat, topService: svc },
      lang as any
    );
  } else if (tpl === "rebook") {
    text = waRebook(
      { name, provider, category: cat, topService: svc },
      lang as any
    );
  }

  // << 2 lines before
  const link = (url.searchParams.get("link") || "").trim();
  if (link) {
    // <<INSERT: ensure exactly one space before link >>
    text = text.replace(/\s+$/, "") + " " + link;
  }
  // 2 lines after >>
  const whatsapp_url = waUrlFor(phone, text);

  return NextResponse.json({
    ok: true,
    slug,
    template: tpl,
    language: lang,
    preview: { text, whatsapp_url },
  });
}
