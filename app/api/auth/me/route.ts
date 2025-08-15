// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: user ? { id: user.id, email: user.email } : null,
  });
}
