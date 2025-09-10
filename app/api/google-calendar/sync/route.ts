// app/api/google-calendar/sync/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabaseAdmin";

/* ----------------- helpers (shared) ----------------- */
function adminOn() {
  return !!process.env.SUPABASE_SERVICE_ROLE;
}
function baseUrl(req: Request) {
  const h = (n: string) => req.headers.get(n);
  const proto = h("x-forwarded-proto") || "https";
  const host = h("x-forwarded-host") || h("host") || "localhost:3000";
  return `${proto}://${host}`;
}
async function logViaApi(
  req: Request,
  event: string,
  source: any = {},
  lead_id: string | null = null,
  provider_id: string | null = null,
  provider_slug: string | null = null
) {
  const url = `${baseUrl(req)}/api/events/log`;
  const body = {
    event,
    source: { ...source, provider_slug },
    lead_id,
    provider_id,
    provider_slug,
  };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/* ----------------- POST: webhook/automation path ----------------- */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) || {};
    const provider_id = body.provider_id || null;
    const provider_slug = (body.provider_slug || "").trim() || null;

    const booking = {
      slug: provider_slug,
      title: body.title || "korekko booking",
      startISO: body.startISO || null,
      endISO: body.endISO || null,
      lead_id: body.lead_id || null,
      customer_name: body.customer_name || null,
      customer_phone: body.customer_phone || null,
      notes: body.notes || null,
    };

    const event = "calendar.booking.synced";
    const payload = {
      event,
      ts: Date.now(),
      provider_id,
      lead_id: booking.lead_id || null,
      source: { booking, via: adminOn() ? "admin" : "api-fallback" },
    };

    if (adminOn()) {
      try {
        const supabase = createAdminClient();
        await supabase.from("Events").insert(payload);
      } catch {
        // ignore and rely on API dual-write
      }
    }

    await logViaApi(
      req,
      event,
      payload.source,
      payload.lead_id,
      payload.provider_id,
      provider_slug
    );

    return NextResponse.json(
      { ok: true, queued: true, echo: { provider_id, provider_slug, booking } },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "sync_failed" },
      { status: 500 }
    );
  }
}

/* ----------------- GET: browser dry-run using session token ----------------- */
async function getSessionAndToken(req: NextRequest) {
  const cookieStore = cookies();

  // 0) Cookie fallback first (set by /api/google-calendar/token on auth finish)
  const cookieTok = cookieStore.get("gc_at")?.value || null;

  // 1) Supabase session token (if exposed)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
  const { data } = await supabase.auth.getSession();
  const session: any = data?.session || null;

  const providerToken =
    session?.provider_token ||
    session?.provider_access_token ||
    cookieTok ||
    null;

  const userId = session?.user?.id || null;
  return { providerToken, userId };
}

async function pushCalendarEvent(
  token: string,
  title: string,
  startISO: string,
  endISO: string,
  description?: string | null
) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        description: description || undefined,
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Check if the primary calendar is busy between startISO and endISO
async function isBusy(token: string, startISO: string, endISO: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: "primary" }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  const cal = json?.calendars?.primary;
  const busy = Array.isArray(cal?.busy) ? cal.busy : [];
  return { ok: res.ok, status: res.status, busy };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const provider_slug = (url.searchParams.get("slug") || "").trim() || null;
    const title = url.searchParams.get("title") || "korekko booking";
    const lead_id = url.searchParams.get("lead_id") || null;
    const startISO =
      url.searchParams.get("startISO") ||
      new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    const endISO =
      url.searchParams.get("endISO") ||
      new Date(Date.now() + 90 * 60 * 1000).toISOString(); // +1.5h

    const { providerToken, userId } = await getSessionAndToken(req);
    if (!providerToken) {
      await logViaApi(
        req,
        "calendar.health.no_token",
        { via: "sync.get" },
        lead_id,
        userId,
        provider_slug
      );
      return new NextResponse(
        JSON.stringify({ ok: false, error: "no_google_token" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Guardrail: refuse if any overlap exists
    const fb = await isBusy(providerToken, startISO, endISO);
    if (!fb.ok) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          status: fb.status,
          error: "calendar_freebusy_failed",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (fb.busy.length > 0) {
      await logViaApi(
        req,
        "calendar.push.conflict",
        { via: "sync.get", conflicts: fb.busy.length },
        lead_id,
        userId,
        provider_slug
      );
      return new NextResponse(
        JSON.stringify({
          ok: false,
          conflict: true,
          busy: fb.busy, // [{start, end}, ...]
          message: "Time slot is already booked",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Push event
    const desc =
      provider_slug || lead_id
        ? `korekko • provider:${provider_slug || "-"} • lead:${lead_id || "-"}`
        : "korekko";
    const pushed = await pushCalendarEvent(
      providerToken,
      title,
      startISO,
      endISO,
      desc
    );

    await logViaApi(
      req,
      pushed.ok ? "calendar.push.ok" : "calendar.push.fail",
      { status: pushed.status, via: "sync.get" },
      lead_id,
      userId,
      provider_slug
    );

    if (!pushed.ok) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          status: pushed.status,
          error: pushed.json?.error || "calendar_api_failed",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        ok: true,
        id: pushed.json?.id || null,
        htmlLink: pushed.json?.htmlLink || null,
        start: pushed.json?.start,
        end: pushed.json?.end,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: e?.message || "sync_get_failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
