// app/auth/callback/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

function hasServiceKey() {
  // Only treat SUPABASE_SERVICE_ROLE as the signal.
  return !!process.env.SUPABASE_SERVICE_ROLE;
}

function baseUrl(req: Request) {
  const h = (n: string) => req.headers.get(n);
  const proto = h("x-forwarded-proto") || "https";
  const host = h("x-forwarded-host") || h("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function logEventSafe(
  req: Request,
  event: string,
  source: any = {},
  lead_id: string | null = null,
  provider_id: string | null = null
) {
  const url = `${baseUrl(req)}/api/events/log`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, source, lead_id, provider_id }),
    keepalive: true,
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const next = url.searchParams.get("next") || "/dashboard";
    const email = (url.searchParams.get("email") || "").trim() || null;
    const now = Date.now();

    if (hasServiceKey()) {
      const supabase = createAdminClient();
      await supabase
        .from("Events")
        .insert({
          event: "auth.google.success",
          ts: now,
          provider_id: null,
          lead_id: null,
          source: { via: "supabase", scope: "contacts.readonly", email },
        })
        .catch(() => {});
      const stubRows = [0, 1, 2].map((i) => ({
        event: "lead.imported",
        ts: now + i,
        provider_id: null,
        lead_id: null,
        source: { from: "gmail", confidence: "stub" },
      }));
      await supabase.from("Events").insert(stubRows).catch(() => {});
    } else {
      await logEventSafe(req, "auth.google.success", {
        via: "supabase",
        scope: "contacts.readonly",
        email,
      });
      for (const i of [0, 1, 2]) {
        await logEventSafe(req, "lead.imported", {
          from: "gmail",
          confidence: "stub",
          ts_hint: now + i,
        });
      }
    }

    return NextResponse.redirect(new URL(next, req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?e=cb", req.url));
  }
}
