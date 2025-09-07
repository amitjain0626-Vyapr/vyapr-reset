// app/api/verification/upload/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("doc");
  if (!file) return NextResponse.json({ ok: false, error: "missing_file" });

  // 🔥 log provider.doc.uploaded
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/events/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "provider.doc.uploaded", source: { name: file.name } }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
