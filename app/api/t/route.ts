// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// mirror of client fallback
const PROVIDER_ID_FALLBACKS: Record<string, string> = {
  amitjain0626: "c56d7dac-c9ed-4828-9c52-56a445fce7b3",
};

function buildMessageFromQuery(q: URLSearchParams) {
  const amount = q.get("amt") || "500";
  const count = q.get("cnt") || "5";
  const expiryDays = q.get("exp") || "7";
  const tid = q.get("tid") || "offer-basic";

  // Keep text in server for consistent preview of what we track as “opened”
  const bases: Record<string, string> = {
    "offer-basic": "Hi 👋 This week only: book {count} slots and save ₹{amount}. Offer valid {expiryDays} days. Reply YES to confirm.",
    "reactivate": "It’s been a while! Book your next visit and get ₹{amount} off. Code: VYAPR. Valid for {expiryDays} days.",
    "new-welcome": "Welcome to our clinic 🙏 First-visit special: ₹{amount} off. Limited to first {count} bookings. Expires in {expiryDays} days.",
  };
  const base = bases[tid] || bases["offer-basic"];
  return base
    .replaceAll("{amount}", String(amount))
    .replaceAll("{count}", String(count))
    .replaceAll("{expiryDays}", String(expiryDays));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams;

  const slug = q.get("slug") || "";
  const template_id = q.get("tid") || "offer-basic";
  const audience = q.get("a") || "All";

  const provider_id = PROVIDER_ID_FALLBACKS[slug] || null;

  // Log template.opened (best-effort; do not block redirect)
  const body = JSON.stringify({
    event: "template.opened",
    ts: Date.now(),
    provider_id, // can be null; DB will enforce if NOT NULL (client sends 'sent' with id anyway)
    source: {
      provider_slug: slug || null,
      template_id,
      audience,
      placeholders: {
        amount: q.get("amt") || "500",
        count: q.get("cnt") || "5",
        expiryDays: q.get("exp") || "7",
      },
      ua: req.headers.get("user-agent") || "",
    },
  });

  try {
    // fire-and-forget; ignore result
    await fetch(new URL("/api/events/log", url.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    // swallow
  }

  // Redirect to WhatsApp composer with the actual message
  const msg = buildMessageFromQuery(q);
  const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  return NextResponse.redirect(wa, { status: 302 });
}
