// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies, headers as nextHeaders } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs"; // ✅ ensure Node runtime (not Edge)

export async function POST(req: Request) {
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

  // ✅ explicitly set the access token so auth context is guaranteed
  const bearer = incomingAuth.startsWith("Bearer ") ? incomingAuth.slice(7) : "";
  if (bearer) await supabase.auth.setAuth(bearer);

  // ...rest of your handler stays the same...
}
