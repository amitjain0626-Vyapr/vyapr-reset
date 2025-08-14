// app/api/auth/magiclink/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function baseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

async function readFormOrJson(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    return {
      email: String(j.email || "").trim(),
      next: String(j.next || "/onboarding"),
    };
  }
  const fd = await req.formData();
  return {
    email: String(fd.get("email") || "").trim(),
    next: String(fd.get("next") || "/onboarding"),
  };
}

export async function POST(req: Request) {
  const { email, next } = await readFormOrJson(req);

  const redirectBack = (params: Record<string, string>) => {
    const u = new URL("/login", baseUrl());
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return NextResponse.redirect(u, { status: 303 });
  };

  if (!email) return redirectBack({ error: "email", next });

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // @ts-ignore
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const redirectTo = `${baseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) return redirectBack({ error: encodeURIComponent(error.message), next });

  return redirectBack({ sent: "1", next });
}

// Optional GET -> 405 so the route is clearly POST-only
export function GET() {
  return new NextResponse("Method Not Allowed", { status: 405 });
}
