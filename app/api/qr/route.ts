// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Accept either ?url= or ?data= ; use whichever is present (non-empty)
  const raw = (
    searchParams.get("url") ||
    searchParams.get("data") ||
    ""
  )
    .toString()
    .trim();

  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "missing_data" },
      { status: 400 }
    );
  }

  // Proxy a PNG QR for ANY string (UPI deeplinks included)
  const upstream = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
    raw
  )}`;
  const res = await fetch(upstream, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "upstream_qr_error", status: res.status },
      { status: 502 }
    );
  }
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
