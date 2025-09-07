// app/api/debug/tg/route.ts
// Tiny verify endpoint to preview TG copy selection.
// Example:
//   /api/debug/tg?category=dentist&service=RCT
//   /api/debug/tg?category=physio
import { NextRequest, NextResponse } from "next/server";
import { pickServicePhrase, getCategoryExamples, TG_TERMS } from "@/lib/copy/tg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const topService = searchParams.get("service");

  const chosen = pickServicePhrase({ category, topService });
  const examples = getCategoryExamples(category, 5);

  return NextResponse.json({
    ok: true,
    category: category || null,
    topService: topService || null,
    chosenPhrase: chosen,
    examples,
    knownCategories: Object.keys(TG_TERMS).sort(),
  });
}
