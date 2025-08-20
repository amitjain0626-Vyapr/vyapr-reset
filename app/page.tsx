// app/page.tsx
// @ts-nocheck
import Link from "next/link";

function OrgJSONLD(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vyapr",
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    sameAs: [
      // future: socials
    ],
  };
}

export const revalidate = 600;

export const metadata = {
  title: "Vyapr — Your Business. Live in 10 Minutes.",
  description:
    "Instant microsite + WhatsApp-first CRM for solos. Get found, convert faster, and grow with smart reminders.",
};

export default function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Top hero (kept lean) */}
      <section className="rounded-3xl border p-6 md:p-10 bg-white">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Your Business. Live in 10 Minutes.
        </h1>
        <p className="mt-3 text-gray-600 max-w-2xl">
          Instant microsite, WhatsApp booking, and a simple CRM that actually helps you grow.
        </p>

        {/* NEW: Directory CTA strengthens internal linking */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-xl border px-5 py-2.5 font-medium hover:shadow-sm transition"
          >
            Get your microsite
          </Link>
          <Link
            href="/directory"
            className="rounded-xl border px-5 py-2.5 font-medium hover:shadow-sm transition"
          >
            Explore the Directory
          </Link>
        </div>
      </section>

{/* --- Directory entry point --- */}
<div className="mt-6">
  <Link href="/directory" className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm hover:shadow-sm">
    Explore the Directory →
  </Link>
</div>

      {/* Secondary discoverability section with a few hard links */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Explore popular categories</h2>
        <p className="mt-1 text-sm text-gray-600">
          Find providers by category and city. These pages are kept fresh automatically.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/directory" className="rounded-2xl border p-4 hover:shadow-sm transition">
            Browse all categories × cities
          </Link>
          {/* Optionally add 1–2 known live links here (safe even if they 404→we fail-open on combo pages) */}
          <Link href="/directory/yoga-delhi" className="rounded-2xl border p-4 hover:shadow-sm transition">
            Yoga in Delhi
          </Link>
          <Link href="/directory/astrologers-mumbai" className="rounded-2xl border p-4 hover:shadow-sm transition">
            Astrologers in Mumbai
          </Link>
        </div>
      </section>

      {/* Organization JSON-LD for brand entity */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(OrgJSONLD(baseUrl || "")) }}
      />
    </main>
  );
}
