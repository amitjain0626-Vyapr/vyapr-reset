// @ts-nocheck
export const runtime = "nodejs";

import Razorpay from "razorpay";
import { NextResponse } from "next/server";

const key_id = process.env.RAZORPAY_KEY_ID!;
const key_secret = process.env.RAZORPAY_KEY_SECRET!;

const rz = new Razorpay({ key_id, key_secret });

export async function POST(req: Request) {
  try {
    const { amount, currency, receipt } = await req.json();

    // amount in the smallest unit (paise)
    const order = await rz.orders.create({
      amount: typeof amount === "number" ? amount : 49900, // ₹499 default
      currency: currency || "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1,
    });

    return NextResponse.json({ ok: true, order, key_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
