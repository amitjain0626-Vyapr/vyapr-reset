// app/api/debug/env/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasSupabaseUrl =
    !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnon =
    !!(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasBaseUrl = !!process.env.NEXT_PUBLIC_BASE_URL;

  return NextResponse.json({
    ok: true,
    hasSupabaseUrl,
    hasServiceRole,
    hasAnon,
    hasBaseUrl,
  });
}
