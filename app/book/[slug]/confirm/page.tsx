// app/book/[slug]/confirm/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function normalizePhoneForWA(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  return digits.replace(/^\+/, "");
}

function buildWa(slug: string, providerName?: string | null, phone?: string | null, whatsapp?: string | null, lid?: string | null, action?: "cancel" | "reschedule") {
  const to = normalizePhoneForWA(whatsapp ?? phone ?? "");
  if (!to) return "";
  const act = action === "cancel" ? "cancel my booking" : "reschedule my booking";
  const msg = encodeURIComponent(
    `Hi ${providerName || "there"}, I’d like to ${act}. Reference: ${lid || "—"} (via Vyapr ${SITE}/book/${slug}).`
  );
  return `https://wa.me/${to}?text=${msg}`;
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lid?: string; amt?: string; svc?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const lid = (sp?.lid || "").toString() || null;
  const amt = (sp?.amt || "").toString();
  const svc = (sp?.svc || "").toString();

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: provider } = await supabase
    .from("Providers")
    .select("id, slug, display_name, phone, whatsapp")
    .eq("slug", slug)
    .maybeSingle();

  const waCancel = buildWa(slug, provider?.display_name, provider?.phone, provider?.whatsapp, lid, "cancel");
  const waResched = buildWa(slug, provider?.display_name, provider?.phone, provider?.whatsapp, lid, "reschedule");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Request sent ✅</h1>
        <p className="text-sm text-gray-600 mt-1">
          You’ll get a confirmation on WhatsApp/SMS soon{amt ? ` • Test amount: ₹${amt}` : ""}{svc ? ` • Service: ${svc}` : ""}.
        </p>
      </header>

      <section className="rounded-2xl border p-5 space-y-3">
        <a
          href={waResched || "#"}
          aria-disabled={!waResched}
          className={`inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold ${
            waResched ? "hover:opacity-95" : "opacity-60 cursor-not-allowed"
          }`}
          target={waResched ? "_blank" : undefined}
          rel={waResched ? "noopener noreferrer" : undefined}
        >
          Reschedule on WhatsApp
        </a>

        <a
          href={waCancel || "#"}
          aria-disabled={!waCancel}
          className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium ${
            waCancel ? "hover:bg-muted/50" : "opacity-60 cursor-not-allowed"
          }`}
          target={waCancel ? "_blank" : undefined}
          rel={waCancel ? "noopener noreferrer" : undefined}
        >
          Cancel on WhatsApp
        </a>

        <Link href={`/book/${slug}`} className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-muted/50">
          Back to profile
        </Link>
      </section>
    </main>
  );
}
