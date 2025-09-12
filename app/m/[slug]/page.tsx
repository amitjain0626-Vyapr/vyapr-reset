// app/m/[slug]/page.tsx
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, COPY } from "@/lib/brand";

const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app";

async function fetchProvider(slug: string) {
  try {
    const r = await fetch(`${ORIGIN}/api/providers/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok || !j?.provider) return null;
    return j.provider; // includes .published (service-role-backed)
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProvider(slug);
  if (!p?.published) {
    return {
      title: COPY.micrositeName,
      description: COPY.micrositeName,
      robots: { index: false, follow: false },
    };
  }
  const title = p?.name ? `${p.name} • ${p.city || "Dentist"}` : COPY.micrositeName;
  const description = p?.name
    ? `Book an appointment with ${p.name}${p.city ? ` in ${p.city}` : ""}.`
    : COPY.micrositeName;
  return { title, description, robots: { index: true, follow: true } };
}

export default async function MicrositePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProvider(slug);

  // Gate public visibility on published flag; avoid RLS issues entirely
  if (!p?.published) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{p.name}</h1>

        {/* Public Verified badge (publish-gated, no schema drift) */}
        <span
          data-test="public-verified-badge"
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
          title="This microsite is published. Verified badge is visible publicly."
        >
          ✓ Verified
        </span>

        <div className="text-sm text-gray-600">
          {p.city ? `${p.city}` : ""}
          {p.city && p.phone ? " • " : ""}
          {p.phone || ""}
        </div>
      </header>

      {/* Intro */}
      <section className="rounded-2xl border p-5 space-y-3">
        <p className="text-sm">
          Public preview for <strong>{p.name}</strong>.
        </p>
        <div className="text-sm text-gray-600">
          Slug: <span className="font-mono">{p.slug}</span>
        </div>
        <div className="text-sm">Online booking and payments coming soon.</div>
      </section>

      {/* Call to action */}
      <section className="rounded-2xl border p-5 space-y-3">
        <h2 className="text-lg font-semibold">Ready to book?</h2>
        <p className="text-sm text-gray-600">
          Pick a time and leave your details. You’ll get a confirmation on WhatsApp/SMS.
        </p>
        <Link
          href={`/book/${p.slug}`}
          className="inline-block rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Book appointment
        </Link>
      </section>
    </main>
  );
}
