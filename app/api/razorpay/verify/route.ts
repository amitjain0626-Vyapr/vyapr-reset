// @ts-nocheck
export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const key_secret = process.env.RAZORPAY_KEY_SECRET!;
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, slug, amount } = body;

    const hmac = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hmac !== razorpay_signature) {
      return NextResponse.json({ ok: false, error: "signature_mismatch" }, { status: 400 });
    }

    // Find provider by slug
    const { data: provider, error: pErr } = await supa
      .from("providers")
      .select("id")
      .eq("slug", slug)
      .single();
    if (pErr || !provider) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    // Record payment event
    await supa.from("events").insert({
      provider_id: provider.id,
      person_id: null, // not mandatory for MVP; we can wire later
      type: "payment",
      meta: {
        amount: Number(amount || 49900) / 100, // store in ₹ for dashboard
        currency: "INR",
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        source: "razorpay",
      },
    });

    // Redirect back to booking page with paid=1
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
