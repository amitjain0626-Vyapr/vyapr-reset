// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClientComponentClient();
        // Use FULL URL so Supabase JS can pick up code + verifier (PKCE) from storage
        const href = window.location.href;

        const { error } = await supabase.auth.exchangeCodeForSession(href);
        if (error) {
          setMsg(`Sign-in failed: ${error.message}`);
          // stay on this page and show error
          return;
        }

        // Optional: confirm we have a user before redirect
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMsg("Sign-in failed: no user after exchange");
          return;
        }

        // Redirect to ?next=/dashboard (default /onboarding)
        const url = new URL(href);
        const next = url.searchParams.get("next") || "/onboarding";
        window.location.replace(next);
      } catch (e: any) {
        setMsg(`Sign-in failed: ${e?.message || "unexpected error"}`);
      }
    };
    run();
  }, []);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">Auth</h1>
      <p className="text-sm text-gray-700">{msg}</p>
    </main>
  );
}
