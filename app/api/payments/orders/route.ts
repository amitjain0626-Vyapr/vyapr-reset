// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { amount_in_paise = 49900, currency = "INR" } = await req.json().catch(() => ({}));
    if (!Number.isInteger(amount_in_paise) || amount_in_paise <= 0) {
      return NextResponse.json({ error: "Invalid amount_in_paise" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // MOCK provider (no external calls)
    const provider = "mock";
    const now = Date.now();
    const order = {
      id: `mock_order_${now}`,
      amount: amount_in_paise,
      currency,
      status: "created",
      receipt: `vyapr_${now}`,
      notes: { user_id: user.id, email: user.email ?? "", source: "vyapr-mock" },
    };

    const { error: insErr } = await supabase.from("Payments").insert({
      user_id: user.id,
      email: user.email ?? null,
      rp_order_id: order.id,
      amount_in_paise: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
      notes: order.notes,
    });

    // Return order even if DB insert fails (surface warning)
    return NextResponse.json(
      { provider, order, dbWarning: insErr?.message },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
