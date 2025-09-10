// app/pay/[leadId]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import LogOnMount from "@/components/telemetry/LogOnMount";

const DEFAULT_UPI = "amit.jain0626@okaxis";

function inr(n?: string | number) {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{
    slug?: string;
    amount?: string;
    upi?: string;
    name?: string;
    enableInPerson?: string;
    in_person?: string;
    pid?: string; // provider_id
    mode?: "in_person" | "phone" | "google_meet";
    meet?: string;
    slot?: string;
    loc?: string;
  }>;
}) {
  const { leadId } = await params;
  const {
    slug = "",
    amount = "",
    upi = "",
    name = "",
    enableInPerson = "1",
    in_person = "0",
    pid = "",
    mode,
    meet = "",
    slot = "",
    loc = "",
  } = await searchParams;

  const allowInPerson = enableInPerson !== "0";

  const amt = Math.max(0, Math.round(Number(amount || "0")));
  const vpa = (upi || DEFAULT_UPI).trim();
  const payeeName = (name || slug || "Korekko Provider").trim();

  const upiLink = `upi://pay?pa=${encodeURIComponent(
    vpa
  )}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(
    String(amt)
  )}&cu=INR&tn=${encodeURIComponent(`Korekko payment ${leadId}`)}`;

  const qrSrc = `/api/qr?url=${encodeURIComponent(upiLink)}`;
  const bookUrl = slug ? `/book/${slug}` : "/";
  const pidQuery = pid ? `&pid=${encodeURIComponent(pid)}` : "";

  // Telemetry payloads
  const shouldLogInPerson = in_person === "1";
  const inPersonPayload = {
    event: "payment.method.selected",
    ts: Date.now(),
    provider_id: pid || null,
    lead_id: leadId || null,
    source: { via: "web", method: "in_person", amount: amt || null, slug },
  };

  const shouldLogMode = !!mode;
  const modePayload = {
    event: "meeting.mode.chosen",
    ts: Date.now(),
    provider_id: pid || null,
    lead_id: leadId || null,
    source: { via: "web", slug, mode: mode || "in_person", trigger: "pay_page" },
  };

  const modeLabel =
    mode === "phone" ? "Phone call" : mode === "google_meet" ? "Google Meet" : "In person";

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      {/* Telemetry on mount */}
      {shouldLogInPerson && <LogOnMount payload={inPersonPayload} />}
      {shouldLogMode && <LogOnMount payload={modePayload} />}

      {/* ✅ Header with Mode + Amount + Slot/Loc */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payment options</h1>
        <p className="text-sm text-gray-600">
          Lead: <span className="font-mono">{leadId}</span>
          {slug ? <> • Provider: <span className="font-mono">{slug}</span></> : null}
        </p>
        <p className="text-sm text-gray-600">
          {mode ? <>Mode: <span className="font-mono">{modeLabel}</span> • </> : null}
          Amount: <span className="font-mono">{inr(amt)}</span>
        </p>
        {(slot || loc) && (
          <p className="text-xs text-gray-500">
            {slot ? <>Slot: <span className="font-mono">{slot}</span></> : null}
            {slot && loc ? " • " : null}
            {loc ? <>Location: <span className="font-mono break-all">{loc}</span></> : null}
          </p>
        )}
      </header>

      {/* Choice strip */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="text-sm font-medium">Choose how you’d like to pay</div>
        <div className="flex flex-wrap gap-2">
          <a
            href={upiLink}
            className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm bg-emerald-50 border-emerald-300 text-center"
            rel="noopener"
          >
            Pay now (UPI)
          </a>

          {allowInPerson && (
            <a
              href={`/pay/${leadId}?slug=${encodeURIComponent(
                slug
              )}&amount=${encodeURIComponent(String(amt))}${pidQuery}&in_person=1${
                mode ? `&mode=${encodeURIComponent(mode)}` : ""
              }${meet ? `&meet=${encodeURIComponent(meet)}` : ""}${
                slot ? `&slot=${encodeURIComponent(slot)}` : ""
              }${loc ? `&loc=${encodeURIComponent(loc)}` : ""}`}
              className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm bg-amber-50 border-amber-300 text-center"
            >
              Pay in person
            </a>
          )}
        </div>
        <div className="sr-only">
          Disable “Pay in person” by appending &enableInPerson=0
        </div>
      </section>

      {/* UPI details */}
      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <div className="text-sm text-gray-500">Amount</div>
        <div className="text-2xl font-semibold">{inr(amt)}</div>

        <div className="text-sm text-gray-500">Pay to</div>
        <div className="font-mono text-sm">{vpa}</div>

        <div className="text-sm text-gray-500">Scan to pay</div>
        <img src={qrSrc} alt="UPI QR" className="w-56 h-56 border rounded-xl" />

        <div className="text-xs text-gray-500">
          Trouble opening the app? Copy this link:&nbsp;
          <span className="break-all font-mono">{upiLink}</span>
        </div>
      </section>

      {slug ? (
        <a
          href={bookUrl}
          className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm"
        >
          Back to booking
        </a>
      ) : null}
    </main>
  );
}
