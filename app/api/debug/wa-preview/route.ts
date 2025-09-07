// app/api/debug/wa-preview/route.ts
// @ts-nocheck
// Preview WA texts with TG-aware service phrases (no schema drift).
// Examples:
//   /api/debug/wa-preview?slug=amitjain0626&category=dentist&name=Amit&provider=Amit%20Jain&tone=pro&lang=en
//   /api/debug/wa-preview?slug=amitjain0626&category=physio&service=back%20pain%20therapy&tone=veli&lang=hinglish

import { NextRequest, NextResponse } from "next/server";
import { waReminder, waRebook, waReminderVeli, waRebookVeli, type WaLang } from "@/lib/wa/templates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Required-ish
  const slug = searchParams.get("slug") || "";

  // Optionals (customer/provider)
  const name = searchParams.get("name") || "";
  const provider = searchParams.get("provider") || "";
  const refCode = searchParams.get("ref") || "";
  const amount = Number(searchParams.get("amount") || "0") || undefined;

  // TG hints (category/service)
  const category = searchParams.get("category");
  const topService = searchParams.get("service");

  // ---- NEW: tone + language switches (non-breaking) ----
  // tone: "pro" (default professional) | "veli" (friendly)
  const tone = (searchParams.get("tone") || "pro").toLowerCase();
  // lang: "en" (default) | "hinglish" | "hi"
  const lang = ((searchParams.get("lang") || "en").toLowerCase() as WaLang);

  const opts = {
    name,
    provider,
    refCode,
    amountINR: amount,
    category,
    topService,
  };

  // Choose variant by tone+lang
  const reminder = tone === "veli" ? waReminderVeli(opts, lang) : waReminder(opts, lang);
  const rebook   = tone === "veli" ? waRebookVeli(opts, lang)   : waRebook(opts, lang);

  // Build a naïve wa.me link to show URL-encoded preview (no phone target)
  const waReminderUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(reminder + " <LINK>")}`;
  const waRebookUrl   = `https://api.whatsapp.com/send?text=${encodeURIComponent(rebook + " <LINK>")}`;

  return NextResponse.json({
    ok: true,
    slug: slug || null,
    inputs: { name, provider, refCode, amountINR: amount, category, topService },
    // Echo switches for UI/debug
    language: lang,
    tone: tone === "veli" ? "veli" : "pro",
    // Texts
    reminder,
    rebook,
    // Preview URLs
    wa: { reminder: waReminderUrl, rebook: waRebookUrl },
  });
}
