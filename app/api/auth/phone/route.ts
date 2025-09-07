// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---- helpers: admin client + provider lookup (matches your WA route pattern)
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function providerBySlug(slug: string) {
  const sb = admin();
  const { data, error } = await sb
    .from("Providers")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data?.id) throw new Error("provider_not_found");
  return data as { id: string; slug: string };
}

async function readJson(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) return {};
  return (await req.json().catch(() => ({}))) || {};
}

export async function GET() {
  // Healthcheck
  return NextResponse.json({ ok: true, route: "/api/auth/phone" });
}

// POST { action: "send" | "verify", phone: "+91...", slug: "..." , token?: "123456" }
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const action = String(body.action || "").trim();
    const phone = String(body.phone || "").trim();
    const slug = String(body.slug || "").trim();
    const token = body.token ? String(body.token).trim() : null;

    if (!action || !phone || !slug) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400 }
      );
    }

    const prov = await providerBySlug(slug);
    const ts = Date.now();
    const sbAdmin = admin();

    // Public supabase client (anon) to call auth
    const sbPublic = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    if (action === "send") {
      // Log telemetry
      await sbAdmin.from("Events").insert({
        event: "auth.otp.requested",
        ts,
        provider_id: prov.id,
      });

      // Send OTP via SMS (Supabase Auth)
      const { error } = await sbPublic.auth.signInWithOtp({
        phone,
        options: {
          // we’re not creating deep-links; user will paste the code manually
          channel: "sms",
        } as any,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message || "otp_send_failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, status: "otp_sent" });
    }

    if (action === "verify") {
      if (!token) {
        return NextResponse.json(
          { ok: false, error: "missing_token" },
          { status: 400 }
        );
      }

      const { data, error } = await sbPublic.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error || !data?.session) {
        return NextResponse.json(
          { ok: false, error: error?.message || "otp_verify_failed" },
          { status: 400 }
        );
      }

      // Log telemetry
      await sbAdmin.from("Events").insert({
        event: "auth.otp.verified",
        ts,
        provider_id: prov.id,
        source: { phone_ends: phone.slice(-4) },
      });

      return NextResponse.json({ ok: true, status: "verified" });
    }

    return NextResponse.json(
      { ok: false, error: "unsupported_action" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}
