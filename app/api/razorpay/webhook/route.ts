// @ts-nocheck
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function verifySignature(rawBody: string, headerSig?: string) {
  if (!WEBHOOK_SECRET) return { ok: false, error: "missing_webhook_secret" };
  if (!headerSig) return { ok: false, error: "missing_signature" };
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  if (expected !== headerSig) return { ok: false, error: "invalid_signature" };
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    // capture URL query for fallbacks (Razorpay lets us add query params to webhook URL)
    const url = new URL(req.url);
    const qProvider = url.searchParams.get("provider_id");
    const qLead = url.searchParams.get("lead_id");

    const raw = await req.text(); // raw body needed for signature
    const sig = req.headers.get("x-razorpay-signature") || req.headers.get("X-Razorpay-Signature") || undefined;

    const ok = verifySignature(raw, sig);
    if (!ok.ok) {
      return NextResponse.json({ ok: false, error: ok.error }, { status: 400 });
    }

    const body = JSON.parse(raw);
    const event = String(body?.event || "");
    const payload = body?.payload || {};

    // Prefer notes on payment → order → else fall back to query params
    const notes =
      payload?.payment?.entity?.notes ||
      payload?.order?.entity?.notes ||
      {};

    let lead_id = notes?.lead_id || qLead || null;
    let provider_id = notes?.provider_id || qProvider || null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // If provider_id still missing but we have lead_id, resolve from Leads
    if (!provider_id && lead_id) {
      const { data: leadRow, error: leadErr } = await supabase
        .from("Leads")
        .select("provider_id")
        .eq("id", lead_id)
        .maybeSingle();
      if (leadErr) throw leadErr;
      provider_id = leadRow?.provider_id ?? null;
    }

    if (!provider_id) {
      return NextResponse.json({ ok: false, error: "provider_id_required" }, { status: 400 });
    }

    // Amount in paise → ₹
    const amountPaise =
      payload?.payment?.entity?.amount ??
      payload?.order?.entity?.amount ??
      null;
    const amount = typeof amountPaise === "number" ? Math.round(amountPaise / 100) : null;

    // Razorpay ids
    const txn_id =
      payload?.payment?.entity?.id ??
      payload?.order?.entity?.id ??
      `rzp-unknown-${Date.now()}`;

    // Only treat these as success
    const successEvents = new Set(["payment.captured", "order.paid", "payment.authorized"]);
    if (!successEvents.has(event)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "non-success-event" });
    }

    const { error: insertErr } = await supabase.from("Events").insert([
      {
        event: "payment.success",
        ts: Date.now(),
        provider_id,
        lead_id: lead_id || null,
        source: {
          via: "razorpay.webhook",
          amount,
          txn_id,
          rp_event: event,
        },
      },
    ]);
    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
