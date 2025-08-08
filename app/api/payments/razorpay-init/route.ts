// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createSupabaseRouteClient } from "@/app/utils/supabase/route";

type Body = {
  amount: number;
  currency?: string;
  dentistId?: string;
  receipt?: string;
  notes?: Record<string, any>;
};

function mockRazorpayOrderId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function mockReceiptId() {
  return `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const amount = Number(body.amount);
    const currency = (body.currency || "INR").toUpperCase();
    const receipt = body.receipt || mockReceiptId();
    const notes = body.notes || {};

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }

    let dentistId = body.dentistId;
    if (!dentistId) {
      const { data: dentist, error: dErr } = await supabase
        .from("Dentists")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (dErr || !dentist) {
        return NextResponse.json(
          { error: "No dentist found for user; pass dentistId explicitly" },
          { status: 400 }
        );
      }
      dentistId = dentist.id;
    }

    const provider_order_id = mockRazorpayOrderId();

    const { data: payment, error: pErr } = await supabase
      .from("Payments")
      .insert({
        dentist_id: dentistId,
        user_id: user.id,
        amount,
        currency,
        provider: "razorpay",
        provider_order_id,
        receipt,
        status: "created",
        notes,
      })
      .select(
        "id, dentist_id, user_id, amount, currency, provider, provider_order_id, receipt, status, created_at"
      )
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: pErr?.message || "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: payment.id,
        provider: payment.provider,
        provider_order_id: payment.provider_order_id,
        amount: payment.amount,
        currency: payment.currency,
        receipt: payment.receipt,
        status: payment.status,
        created_at: payment.created_at,
        dentist_id: payment.dentist_id,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
