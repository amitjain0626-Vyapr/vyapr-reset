// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClientComponentClient();
        const href = window.location.href;
        const url = new URL(href);
        const next = url.searchParams.get("next") || "/onboarding";

        const code = url.searchParams.get("code");            // PKCE / OAuth flow
        const token_hash = url.searchParams.get("token_hash"); // Magic-link flow
        const type = (url.searchParams.get("type") || "magiclink") as
          "magiclink" | "recovery" | "email_change" | "signup" | "invite";

        if (code) {
          // PKCE: browser holds the verifier
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw new Error(error.message);
        } else if (token_hash) {
          // MAGIC LINK: must *not* include email here
          const { error } = await supabase.auth.verifyOtp({ type, token_hash });
          if (error) throw new Error(error.message);
        } else {
          throw new Error("Missing code or token_hash");
        }

        // Confirm session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("no user after auth");

        // Go to destination
        window.location.replace(next);
      } catch (e: any) {
        setMsg(`Sign-in failed: ${e?.message || "unexpected error"}`);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">Authentication</h1>
      <p className="text-sm text-gray-700">{msg}</p>
    </main>
  );
}
