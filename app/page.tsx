// app/page.tsx
// @ts-nocheck
import Link from "next/link";
import T from "@/components/i18n/T";
import LanguageToggle from "@/components/i18n/LanguageToggle";

function OrgJSONLD(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Korekko",
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    sameAs: [
      // future: socials
    ],
  };
}

export const revalidate = 600;

export const metadata = {
  title: "Korekko — Your Business. Live in 10 Minutes.",
  description:
    "Instant microsite + WhatsApp-first CRM for solos. Get found, convert faster, and grow with smart reminders.",
};

export default function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Lang toggle row */}
      <div className="flex items-center justify-end">
        <LanguageToggle />
      </div>

      {/* Top hero (kept lean) */}
      <section className="rounded-3xl border p-6 md:p-10 bg-white mt-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          <T
            en="Your Business. Live in 10 Minutes."
            hi="Aapka business — 10 minute mein live."
          />
        </h1>
        <p className="mt-3 text-gray-600 max-w-2xl">
          <T
            en="Instant microsite, WhatsApp booking, and a simple CRM that actually helps you grow."
            hi="Turant microsite, WhatsApp par booking, aur ek simple CRM jo waaqai growth laata hai."
          />
        </p>

        {/* NEW: Directory CTA strengthens internal linking */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/onboarding"
            className="rounded-xl border px-5 py-2.5 font-medium hover:shadow-sm transition"
          >
            <T en="Get your microsite" hi="Apna microsite banaiye" />
          </Link>
          <Link
            href="/directory"
            className="rounded-xl border px-5 py-2.5 font-medium hover:shadow-sm transition"
          >
            <T en="Explore the Directory" hi="Directory dekhiye" />
          </Link>
        </div>
      </section>

      {/* --- Directory entry point --- */}
      <div className="mt-6">
        <Link
          href="/directory"
          className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2 text-sm hover:shadow-sm"
        >
          <T en="Explore the Directory →" hi="Directory dekhiye →" />
        </Link>
      </div>

      {/* Secondary discoverability section with a few hard links */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          <T en="Explore popular categories" hi="Popular categories explore kariye" />
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          <T
            en="Find providers by category and city. These pages are kept fresh automatically."
            hi="Category aur sheher ke hisaab se providers dhoondhiye. Ye pages khud-ba-khud updated rehte hain."
          />
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/directory" className="rounded-2xl border p-4 hover:shadow-sm transition">
            <T en="Browse all categories × cities" hi="Saare category × sheher dekhiye" />
          </Link>
          <Link href="/directory/yoga-delhi" className="rounded-2xl border p-4 hover:shadow-sm transition">
            <T en="Yoga in Delhi" hi="Delhi mein Yoga" />
          </Link>
          <Link href="/directory/astrologers-mumbai" className="rounded-2xl border p-4 hover:shadow-sm transition">
            <T en="Astrologers in Mumbai" hi="Mumbai mein Astrologers" />
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
