// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies, headers as nextHeaders } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: Request) {
  const cookieStore = cookies();
  const incomingAuth = req.headers.get("authorization") || "";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => cookieStore.get(n)?.value,
        set: (n: string, v: string, o: any) => { try { cookieStore.set({ name: n, value: v, ...o }); } catch {} },
        remove: (n: string, o: any) => { try { cookieStore.set({ name: n, value: "", ...o }); } catch {} },
      },
      global: {
        headers: {
          authorization: incomingAuth,
          "x-forwarded-for": nextHeaders().get("x-forwarded-for") || "",
          "x-request-id": nextHeaders().get("x-request-id") || "",
        },
      },
    }
  );

  // Also set the bearer explicitly (some SSR contexts need this)
  const bearer = incomingAuth.startsWith("Bearer ") ? incomingAuth.slice(7) : "";
  if (bearer) await supabase.auth.setAuth(bearer);

  const { data: session } = await supabase.auth.getSession();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  // Try a safe RLS read to see if policies work
  const { data: prov, error: provErr } = await supabase
    .from("providers")
    .select("id, owner_id, display_name")
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    ok: true,
    incomingAuth: incomingAuth ? "present" : "missing",
    session_present: Boolean(session?.session),
    user_present: Boolean(userRes?.user),
    user_error: userErr?.message || null,
    user: userRes?.user ? { id: userRes.user.id, email: userRes.user.email } : null,
    providers_select_ok: !!prov && Array.isArray(prov),
    providers_error: provErr?.message || null,
  });
}
