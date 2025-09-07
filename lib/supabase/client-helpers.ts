// lib/supabase/client-helpers.tsx
// @ts-nocheck

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

/** Browser client */
export function createBrowserSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });
}

/** Server-safe telemetry helper for API routes */
export async function logServerRoute(path: string, meta: any = {}) {
  try {
    await fetch(`${BASE}/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "server.route.hit",
        source: { path, ...meta },
      }),
      keepalive: true,
    });
  } catch {}
}
