// app/pay/[leadId]/reschedule/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import RescheduleForm from "@/components/reschedule/RescheduleForm";

export default async function ReschedulePage(props: any) {
  const rawParams =
    props?.params && typeof props.params.then === "function" ? await props.params : props.params || {};
  const rawSearch =
    props?.searchParams && typeof props.searchParams.then === "function"
      ? await props.searchParams
      : props.searchParams || {};

  const leadId = (rawParams?.leadId || "").toString();
  const slug = (rawSearch.slug || "").toString().trim();
  const name = (rawSearch.name || "").toString().trim();
  const provider = (rawSearch.provider || "").toString().trim();

  // Optional hours via URL (?start=11&end=18) — safe defaults, no schema drift.
  const start = Math.min(23, Math.max(0, Number(rawSearch.start) || 10));
  const end = Math.min(23, Math.max(start + 1, Number(rawSearch.end) || 19));

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      <div className="rounded-2xl border p-5 bg-white space-y-4">
        <h1 className="text-xl font-semibold">Pick a new time</h1>
        <p className="text-sm text-gray-600">
          You’re rescheduling with {provider || slug}. All times shown in <strong>IST</strong>.
        </p>

        <RescheduleForm
          slug={slug}
          leadId={leadId}
          name={name}
          provider={provider || slug}
          startHour={start}
          endHour={end}
        />

        <p className="text-xs text-gray-500">You’ll be taken to WhatsApp with a ready-to-send message.</p>
      </div>
    </main>
  );
}
