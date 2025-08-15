// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [msg, setMsg] = useState("Signing you in…");
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const href = typeof window !== "undefined" ? window.location.href : "";
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const next = (url?.searchParams.get("next") || "/onboarding") as string;
  const code = url?.searchParams.get("code") || null;                // PKCE / OAuth
  const token_hash = url?.searchParams.get("token_hash") || null;    // Magic link
  const type = (url?.searchParams.get("type") || "magiclink") as
    | "magiclink" | "recovery" | "email_change" | "signup" | "invite";

  // Try auto sign-in on mount
  useEffect(() => {
    (async () => {
      try {
        // Case 1: PKCE/OAuth flow (has 'code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw error;
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("no user after exchange");
          window.location.replace(next);
          return;
        }

        // Case 2: Magic link (has token_hash but may lack email)
        if (token_hash) {
          // Try email from URL first
          const emailFromUrl = (url?.searchParams.get("email") || "").trim();
          if (emailFromUrl) {
            const { error } = await supabase.auth.verifyOtp({ type, token_hash, email: emailFromUrl });
            if (error) throw error;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("no user after verify");
            window.location.replace(next);
            return;
          }

          // No email in URL — ask the user once
          setMsg("Please confirm your email to finish sign-in.");
          setNeedEmail(true);
          return;
        }

        setMsg("Missing code or token. Please request a new link.");
      } catch (e: any) {
        setMsg(`Sign-in failed: ${e?.message || "unexpected error"}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual verify when user types email
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token_hash) {
      setMsg("Missing token. Please request a new link.");
      return;
    }
    if (!email.trim()) {
      setMsg("Enter your email address to continue.");
      return;
    }
    setBusy(true);
    setMsg("Verifying…");
    try {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
        email: email.trim(),
      });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user after verify");
      window.location.replace(next);
    } catch (e: any) {
      setMsg(`Sign-in failed: ${e?.message || "unexpected error"}`);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-2">Authentication</h1>
      <p className="text-sm text-gray-700 mb-4">{msg}</p>

      {needEmail && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border p-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Continue"}
          </button>
        </form>
      )}
    </main>
  );
}
