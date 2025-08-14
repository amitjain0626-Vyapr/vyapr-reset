// No "use server" here — this file is safe to import in a client component.
// It calls your existing API routes under /api/payments/* from the browser.

type Ok<T = any> = { ok: true } & T;
type Err = { ok: false; error: any };

function toErr(e: unknown, fallback: string): Err {
  if (typeof e === "string") return { ok: false, error: e };
  if (e && typeof e === "object") return { ok: false, error: e as any };
  return { ok: false, error: fallback };
}

/** Create a Razorpay order via your existing API: /api/payments/orders (POST) */
export async function createOrder(
  slug: string,
  amount: number,
  currency = "INR"
): Promise<Ok<{ id: string; amount: number; currency: string }> | Err> {
  try {
    const res = await fetch("/api/payments/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ slug, amount, currency }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      return toErr(json?.error || json || `Order creation failed (${res.status})`, "Order creation failed");
    }

    // Expecting your route to return: { ok:true, data:{ id, amount, currency } }
    const data = json.data || {};
    return { ok: true, id: data.id, amount: data.amount, currency: data.currency };
  } catch (e) {
    return toErr(e, "Order creation exception");
  }
}

/** Verify Razorpay signature via /api/payments/razorpay (POST) */
export async function verifyPayment(
  response: any
): Promise<Ok<{ payment_id?: string; order_id?: string; signature?: string }> | Err> {
  try {
    const res = await fetch("/api/payments/razorpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(response),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      return toErr(json?.error || json || `Payment verification failed (${res.status})`, "Payment verification failed");
    }

    // Expecting: { ok:true, data:{ payment_id, order_id, signature } }
    return { ok: true, ...(json.data || {}) };
  } catch (e) {
    return toErr(e, "Payment verification exception");
  }
}

/** Record the verified payment via /api/payments/mark-paid (POST) */
export async function recordPayment(
  slug: string,
  verify: any
): Promise<Ok | Err> {
  try {
    const res = await fetch("/api/payments/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ slug, verify }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      return toErr(json?.error || json || `Payment record failed (${res.status})`, "Payment record failed");
    }

    return { ok: true };
  } catch (e) {
    return toErr(e, "Payment record exception");
  }
}
