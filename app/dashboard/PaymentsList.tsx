// app/login/actions.ts
// Server Action: send magic link with a safe absolute redirect URL.
// @ts-nocheck
"use server";

import { redirect, headers } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function computeBaseUrl() {
  // Prefer explicit env in staging/prod
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  // Fallback to request headers in dev
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}

/**
 * Server Action: sends a magic link.
 * Expect to be used in <form action={sendMagicLink}>.
 */
export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const next = String(formData.get("next") || "/onboarding");

  if (!email) redirect("/login?error=email");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?error=supabase_config");

  const base = computeBaseUrl();
  const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  // Show “check your email” on same page
  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}
