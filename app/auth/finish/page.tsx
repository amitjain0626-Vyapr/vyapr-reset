// app/auth/finish/page.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SITE =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DEFAULT_FALLBACK_SLUG = "amitjain0626";

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

function pickSlugLike(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  // Try common shapes without schema drift
  if (typeof obj.slug === "string" && obj.slug) return obj.slug;
  if (typeof obj.provider_slug === "string" && obj.provider_slug) return obj.provider_slug;
  if (obj.data && typeof obj.data.slug === "string" && obj.data.slug) return obj.data.slug;
  if (obj.profile && typeof obj.profile.slug === "string" && obj.profile.slug) return obj.profile.slug;
  return null;
}

async function resolveProviderSlug(): Promise<string> {
  // 1) If URL already has ?slug=..., respect it.
  const url = new URL(window.location.href);
  const urlSlug = url.searchParams.get("slug");
  if (urlSlug) return urlSlug;

  // 2) Try /api/dentists/me (present in repo per folder index)
  try {
    const r = await fetch("/api/dentists/me", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const s = pickSlugLike(j) || pickSlugLike(j?.dentist) || pickSlugLike(j?.me);
    if (s) return s;
  } catch {}

  // 3) Try /api/debug/me as a fallback
  try {
    const r2 = await fetch("/api/debug/me", { cache: "no-store" });
    const j2 = await r2.json().catch(() => ({}));
    const s2 = pickSlugLike(j2) || pickSlugLike(j2?.user) || pickSlugLike(j2?.profile);
    if (s2) return s2;
  } catch {}

  // 4) Last resort: localStorage hint or default
  try {
    const ls = localStorage.getItem("vyapr:lastSlug");
    if (ls) return ls;
  } catch {}

  return DEFAULT_FALLBACK_SLUG;
}

export default function AuthFinishPage() {
  const [msg, setMsg] = useState("Finalizing sign-in…");

  useEffect(() => {
    (async () => {
      const supabase = makeSb();

      try {
        // 1) Persist session from URL hash if present
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        // 2) Telemetry (updated scope list)
        await safeLog("auth.google.success", {
          via: "supabase",
          scopes: ["contacts.readonly", "calendar.events"],
        });

        // 3) Best-effort stub imports (contract placeholder)
        const now = Date.now();
        for (const i of [0, 1, 2]) {
          // fire-and-forget
          safeLog("lead.imported", {
            from: "gmail",
            confidence: "stub",
            ts_hint: now + i,
          });
        }

        // 4) Resolve provider slug and redirect to dashboard with slug guardrail
        const slug = await resolveProviderSlug();
        setMsg("Signed in. Taking you to dashboard…");
        window.location.replace(`/dashboard?slug=${encodeURIComponent(slug)}`);
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
