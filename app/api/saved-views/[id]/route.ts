// app/api/saved-views/[id]/route.ts
// @ts-nocheck
// Minimal, App Router–compatible route: only export the HTTP method.
// Use NextRequest; leave `context` untyped to satisfy Next's checker.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function readCookie(req: NextRequest, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    const k = p.slice(0, i);
    if (k === name) return decodeURIComponent(p.slice(i + 1));
  }
  return undefined;
}

export async function DELETE(req: NextRequest, context: any) {
  const id = (context?.params?.id ?? "").toString();
  if (!id || id.length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return readCookie(req, name);
        },
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );

  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("SavedViews").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
