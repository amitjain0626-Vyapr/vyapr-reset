// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

type Body = {
  provider_id?: string;
  slug?: string;
  order_id?: string;
  payment_id?: string;
  amount?: number | string;
  currency?: string;
};

function bad(reqId: string, msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg, reqId }, { status: code });
}

function toPaise(amount: number | string | undefined) {
  if (amount === undefined || amount === null) return null;
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) && n >= 1000 ? n : Math.round(n * 100);
}

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();

  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return bad(reqId, "Invalid JSON body");
  }

  const provider_id = (payload.provider_id || "").trim();
  const slug = (payload.slug || "").trim();
  const order_id = (payload.order_id || "").trim();
  const payment_id = (payload.payment_id || "").trim();
  const currency = (payload.currency || "INR").trim().toUpperCase();
  const amount_paise = toPaise(payload.amount);

  if (!provider_id) return bad(reqId, "provider_id required");
  if (!slug) return bad(reqId, "slug required");
  if (!order_id) return bad(reqId, "order_id required");
  if (!payment_id) return bad(reqId, "payment_id required");
  if (!amount_paise) return bad(reqId, "valid amount required");

  const supabase = createAdminClient();

  // Idempotent check
  try {
    const { data: existing } = await supabase
      .from("Events") // capitalized table name
      .select("id")
      .eq("type", "payment_captured")
      .filter("meta->>payment_id", "eq", payment_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, reqId, idempotent: true });
    }
  } catch (e) {
    console.warn("[payments:record] existence check failed", { reqId, e });
  }

  // Insert telemetry event
  const telemetry = {
    type: "payment_captured",
    provider_id,
    ts: new Date().toISOString(),
    meta: {
      provider_id,
      slug,
      order_id,
      payment_id,
      amount: amount_paise,
      currency,
      reqId,
      source: "record-payment-route",
    },
  };

  try {
    const { error: insertErr } = await supabase.from("Events").insert(telemetry); // capitalized table
    if (insertErr) {
      console.error("[payments:record] Events insert failed", { reqId, insertErr });
      return NextResponse.json({
        ok: false,
        reqId,
        error: "telemetry insert failed",
      });
    }
  } catch (e) {
    console.error("[payments:record] Events insert threw", { reqId, e });
    return bad(reqId, "telemetry insert exception");
  }

  return NextResponse.json({ ok: true, reqId });
}
