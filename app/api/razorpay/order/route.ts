// app/api/razorpay/order/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return { keyId, keySecret };
}

export async function POST(req: Request) {
  const { keyId, keySecret } = getKeys();
  if (!keyId || !keySecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay not configured",
        details: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel env",
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount ?? 5000); // in paise
  const currency = String(body.currency ?? "INR");
  const receipt = String(body.receipt ?? `rcpt_${Date.now()}`);
  const notes = body.notes ?? {};

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes,
      payment_capture: 1,
    }),
  });

  const data = await rpRes.json().catch(() => ({}));

  if (!rpRes.ok) {
    return NextResponse.json({ ok: false, error: "razorpay_error", data }, { status: rpRes.status });
  }

  return NextResponse.json({ ok: true, order: data }, { status: 200 });
}

// Optional: make GET explicit so bots don’t trigger it
export function GET() {
  return NextResponse.json({ ok: true, info: "POST to create a Razorpay order" });
}
