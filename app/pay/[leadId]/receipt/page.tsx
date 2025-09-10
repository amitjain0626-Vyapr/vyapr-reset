// app/pay/[leadId]/receipt/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

/* ---------- Supabase admin (server) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getProviderBySlug(slug: string) {
  if (!slug) return { id: null, display_name: null, slug: null };
  const sb = admin();
  const { data } = await sb
    .from("Providers")
    .select("id, display_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data || { id: null, display_name: null, slug };
}

function toINR(n?: string | number) {
  if (n === undefined || n === null || n === "") return "";
  const num = Number(n);
  if (!isFinite(num) || num <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function istPretty(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(iso));
  } catch { return ""; }
}

/* ---------- Polished, bilingual WA text ---------- */
function buildWaText({ patientName, amountINR, providerName, note, upi, slotPretty }: {
  patientName?: string; amountINR?: string; providerName: string; note?: string; upi?: string; slotPretty?: string;
}) {
  const hi = patientName ? `Hi ${patientName},` : "Hi,";
  const en = [
    `${hi} thanks for your payment of ${amountINR || "₹—"} to ${providerName}.`,
    slotPretty ? `Your booking is confirmed for ${slotPretty} (IST).` : `Your booking is confirmed.`,
    note ? `Note: ${note}` : null,
    upi ? `UPI Ref: ${upi}` : null,
    `— ${providerName} (via Korekko)`
  ].filter(Boolean).join("\n");

  const hiIn = [
    patientName ? `नमस्ते ${patientName},` : "नमस्ते,",
    `${providerName} को ${amountINR || "₹—"} का भुगतान प्राप्त हुआ है।`,
    slotPretty ? `आपकी बुकिंग ${slotPretty} (IST) के लिए पक्की है।` : `आपकी बुकिंग कन्फर्म कर दी गई है।`,
    note ? `टिप्पणी: ${note}` : null,
    upi ? `UPI संदर्भ: ${upi}` : null,
    `— ${providerName} (Korekko)`
  ].filter(Boolean).join("\n");

  return hiIn + "\n\n" + en;
}

export default async function ReceiptPage(props: any) {
  const rawParams = props?.params && typeof props.params.then === "function" ? await props.params : props.params || {};
  const rawSearch =
    props?.searchParams && typeof props.searchParams.then === "function"
      ? await props.searchParams
      : props.searchParams || {};

  const leadId = (rawParams?.leadId || "").toString();
  const slug = (rawSearch.slug || "").toString().trim();
  const amount = (rawSearch.amount || "").toString().trim();
  const note = (rawSearch.note || "").toString().trim();
  const upi = (rawSearch.upi || "").toString().trim();
  const name = (rawSearch.name || "").toString().trim();
  const provider = (rawSearch.provider || "").toString().trim();
  const send = (rawSearch.send || "").toString().trim();

  // Optional slot (either `slot` as pretty text or ISO via `slotISO`)
  const slotText = (rawSearch.slot || "").toString().trim();
  const slotISO = (rawSearch.slotISO || "").toString().trim();
  const slotPretty = slotText || istPretty(slotISO);

  const providerRow = await getProviderBySlug(slug);
  const providerId = providerRow?.id || null;
  const providerName = (provider || providerRow?.display_name || slug || "your provider").toString();
  const amountINR = toINR(amount);

  const waText = buildWaText({ patientName: name, amountINR, providerName, note, upi, slotPretty });
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  if (send && send !== "0" && send !== "false") {
    await admin().from("Events").insert({
      event: "payment.success",
      ts: Date.now(),
      provider_id: providerId,
      lead_id: leadId,
      source: { via: "wa.receipt", amount: amount ? Number(amount) : null },
    });
    redirect(waHref);
  }

  const reschedHref = `/pay/${encodeURIComponent(leadId)}/reschedule?${new URLSearchParams({
    slug,
    name,
    provider: providerName,
  }).toString()}`;

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      <div className="rounded-2xl border p-5 bg-white space-y-3">
        <h1 className="text-xl font-semibold">Payment received 🎉</h1>
        <p className="text-sm text-gray-600">
          {amountINR ? <>Amount: <strong>{amountINR}</strong></> : "Amount recorded."}
        </p>
        {slotPretty ? <p className="text-sm text-gray-600">Time: {slotPretty} <span className="text-gray-500">(IST)</span></p> : null}
        {note ? <p className="text-sm text-gray-600">Note: {note}</p> : null}
        <p className="text-sm text-gray-600">Provider: {providerName}</p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <a
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 text-center"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Send WhatsApp receipt
          </a>
          <Link
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700 text-center"
            href={reschedHref}
          >
            Need to pick another time?
          </Link>
          <Link
            className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-center"
            href={`/book/${encodeURIComponent(slug)}`}
          >
            Back to booking page
          </Link>
        </div>

        <div className="text-xs text-gray-500 pt-2">
          WhatsApp copy is bilingual (Hindi + English) and includes IST time if provided.
        </div>
      </div>
    </main>
  );
}
