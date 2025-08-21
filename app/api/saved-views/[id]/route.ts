// app/api/saved-views/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  // Validate param
  const id = (context?.params?.id ?? "").toString();
  if (!id || id.length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  // Authenticated Supabase with cookie passthrough (RLS applies)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
          return;
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, expires: new Date(0) });
          return;
        },
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
