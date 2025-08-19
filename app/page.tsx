// @ts-nocheck
// app/page.tsx
// Homepage with Organization JSON-LD + visible links to help crawling.

import OrgJsonLd from "@/components/seo/OrgJsonLd";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Organization JSON-LD for brand signals */}
      <OrgJsonLd
        name="Vyapr"
        logoPath="/logo.png"   // optional; add /public/logo.png later if you want
        sameAs={[
          // add socials if/when available
          // "https://www.linkedin.com/company/your-handle",
          // "https://x.com/your-handle",
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Vyapr</h1>
        <p className="mt-2 text-gray-700">
          Microsites and bookings for India’s solos. Explore a few live pages below.
        </p>
      </header>

      {/* Simple internal links so crawlers discover key URLs from / */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-xl font-semibold mb-3">Explore</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a className="hover:underline" href="/directory/yoga-delhi">
              Yoga in Delhi (Directory)
            </a>
          </li>
          <li>
            <a className="hover:underline" href="/book/amit">
              Amit (Provider page)
            </a>
          </li>
          <li>
            <a className="hover:underline" href="/book/chic">
              Chic (Provider page)
            </a>
          </li>
          <li>
            <a className="hover:underline" href="/book/amitjain0626">
              amitjain0626 (Provider page)
            </a>
          </li>
          <li>
            <a className="hover:underline" href="/book/dr-kapoor">
              dr-kapoor (Provider page)
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
