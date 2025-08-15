// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const supabase = createClientComponentClient();
      const href = window.location.href;
      const url = new URL(href);
      const next = url.searchParams.get("next") || "/onboarding";

      const code = url.searchParams.get("code");            // OAuth/PKCE case
      const token_hash = url.searchParams.get("token_hash"); // Magic-link case
      const type = url.searchParams.get("type") || "magiclink";
      const email = (url.searchParams.get("email") || "").trim(); // passed from sender

      try {
        if (code) {
          // OAuth-style; Supabase JS will use stored verifier
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw new Error(error.message);
        } else if (token_hash) {
          if (!email) throw new Error("Missing email for magic link verify");
          const { error } = await supabase.auth.verifyOtp({ type, token_hash, email });
          if (error) throw new Error(error.message);
        } else {
          throw new Error("Missing code/token_hash");
        }

        // Confirm session, then go
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("no user after exchange");
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
