// app/login/actions.ts
// @ts-nocheck
"use server";

import { redirect, headers } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function baseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const next = String(formData.get("next") || "/onboarding");

  if (!email) redirect("/login?error=email");

  const supabase = createSupabaseServerClient();
  if (!supabase) redirect("/login?error=supabase_config");

  const redirectTo = `${baseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);

  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}
