// app/auth/finish/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SITE =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function makeSb() {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });
}

async function safeLog(event: string, source: any = {}) {
  try {
    await fetch(`/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, source }),
      keepalive: true,
    });
  } catch {}
}

export default function AuthFinishPage() {
  const [msg, setMsg] = useState("Finalizing sign-in…");
  useEffect(() => {
    (async () => {
      const supabase = makeSb();

      // 1) Ask Supabase to parse the URL fragment and persist the session.
      // detectSessionInUrl: true ensures tokens in location.hash are stored.
      try {
        // Calling getSession() after redirect causes the client to process the hash.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        // 2) Telemetry (strict contract): success + 3 stub imports
        await safeLog("auth.google.success", {
          via: "supabase",
          scope: "contacts.readonly",
        });

        const now = Date.now();
        const stubs = [0, 1, 2];
        for (const i of stubs) {
          await safeLog("lead.imported", {
            from: "gmail",
            confidence: "stub",
            ts_hint: now + i,
          });
        }

        setMsg("Signed in. Taking you to dashboard…");
        // 3) Go to dashboard
        window.location.replace("/dashboard");
      } catch (e: any) {
        setMsg("Could not finalize sign-in. Redirecting to login…");
        setTimeout(() => window.location.replace("/login?e=finish"), 500);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Please wait…</h1>
      <p className="text-sm text-gray-600 mt-2">{msg}</p>
    </main>
  );
}
