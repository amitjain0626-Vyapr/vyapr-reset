// @ts-nocheck
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, api: "src/app/api/leads/ping/route.ts" });
}
