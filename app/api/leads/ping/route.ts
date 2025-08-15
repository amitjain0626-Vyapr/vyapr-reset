// @ts-nocheck
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, api: "app/api/leads/ping/route.ts" });
}
