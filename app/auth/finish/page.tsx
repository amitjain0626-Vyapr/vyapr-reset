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

/**
 * NOTE (branding):
 * - User-visible copy says “Korekko”.
 * - We KEEP existing localStorage key `vyapr:lastSlug` for backward compat.
 */
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
  if (typeof obj.slug === "string" && obj.slug) return obj.slug;
  if (typeof obj.provider_slug === "string" && obj.provider_slug) return obj.provider_slug;
  if (obj.data && typeof obj.data.slug === "string" && obj.data.slug) return obj.data.slug;
  if (obj.profile && typeof obj.profile.slug === "string" && obj.profile.slug) return obj.profile.slug;
  return null;
}

async function resolveProviderSlug(): Promise<string> {
  // 1) If URL already has ?slug=..., respect it.
  try {
    const url = new URL(window.location.href);
    const urlSlug = url.searchParams.get("slug");
    if (urlSlug) return urlSlug;
  } catch {}

  // 2) Try API hints (no schema drift)
  try {
    const r = await fetch("/api/dentists/me", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    const s = pickSlugLike(j) || pickSlugLike(j?.dentist) || pickSlugLike(j?.me);
    if (s) return s;
  } catch {}
  try {
    const r2 = await fetch("/api/debug/me", { cache: "no-store" });
    const j2 = await r2.json().catch(() => ({}));
    const s2 = pickSlugLike(j2) || pickSlugLike(j2?.user) || pickSlugLike(j2?.profile);
    if (s2) return s2;
  } catch {}

  // 3) LocalStorage hint (back-compat key)
  try {
    const ls = localStorage.getItem("vyapr:lastSlug");
    if (ls) return ls;
  } catch {}

  // 4) Fallback
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

        // 2) Capture Google provider token → persist via secure cookie for server routes
        try {
          const tok =
            (data?.session as any)?.provider_token ||
            (data?.session as any)?.provider_access_token ||
            null;
          if (tok) {
            await fetch("/api/google-calendar/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: tok }),
              keepalive: true,
            });
          }
        } catch {}

        // 3) Telemetry
        await safeLog("auth.google.success", {
          via: "supabase",
          scopes: ["contacts.readonly", "calendar.events"],
        });

        // 4) Best-effort stub events (placeholder)
        const now = Date.now();
        for (const i of [0, 1, 2]) {
          safeLog("lead.imported", { from: "gmail", confidence: "stub", ts_hint: now + i });
        }

        // 5) Resolve slug, remember locally (back-compat key), and redirect
        const slug = await resolveProviderSlug();
        try {
          localStorage.setItem("vyapr:lastSlug", slug);
        } catch {}

        setMsg("Signed in. Taking you to the Korekko dashboard…");
        // Important: go straight to the Leads page with the slug
        window.location.replace(`/dashboard/leads?slug=${encodeURIComponent(slug)}`);
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
