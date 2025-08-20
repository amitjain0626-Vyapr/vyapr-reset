// app/directory/page.tsx
// @ts-nocheck
import Link from "next/link";

// --- Config: feature combos to show on the index ---
// Keep this tiny & static for now; later we can fetch from DB if needed.
// Only published providers should be discoverable on combo pages (already gated there).
const FEATURED_COMBOS: Array<{ combo: string; label: string; blurb: string }> = [
  { combo: "dance-pune",        label: "Dance teachers in Pune",        blurb: "Find trained dance instructors near you" },
  { combo: "yoga-delhi",        label: "Yoga trainers in Delhi",        blurb: "Beginner to advanced, home & studio sessions" },
  { combo: "music-bangalore",   label: "Music teachers in Bengaluru",   blurb: "Vocal & instrumental classes for all ages" },
  { combo: "makeup-mumbai",     label: "Makeup artists in Mumbai",      blurb: "Party, bridal & editorial looks" },
  { combo: "tutors-delhi",      label: "Home tutors in Delhi",          blurb: "Academic coaching across classes & boards" },
  { combo: "astrologers-pune",  label: "Astrologers in Pune",           blurb: "Tarot, Vedic, and horoscope consultations" },
];

// Helpers
const site = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
const url = `${site}/directory`;

function BreadcrumbsJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${site}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Directory",
        "item": url
      }
    ]
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function ItemListJsonLd() {
  const items = FEATURED_COMBOS.map((c, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": c.label,
    "url": `${site}/directory/${c.combo}`
  }));

  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": items
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export const metadata = {
  title: "Directory — Vyapr",
  description: "Explore featured category–city pages to find local providers on Vyapr.",
  alternates: { canonical: url },
};

export default function DirectoryIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Visible breadcrumbs (UI only) */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex gap-2 text-gray-600">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium">Directory</li>
        </ol>
      </nav>

      <h1 className="text-2xl md:text-3xl font-semibold mb-2">Explore providers by city & category</h1>
      <p className="text-gray-600 mb-8">
        Jump into our most requested combos. Each page lists published providers only.
      </p>

      {/* Grid of featured combos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURED_COMBOS.map(({ combo, label, blurb }) => (
          <Link
            key={combo}
            href={`/directory/${combo}`}
            className="block rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <h2 className="text-lg font-medium">{label}</h2>
            <p className="text-sm text-gray-600 mt-1">{blurb}</p>
            <span className="inline-block mt-3 text-sm underline">View {combo.replace("-", " ")} →</span>
          </Link>
        ))}
      </section>

      {/* JSON-LD */}
      <BreadcrumbsJsonLd />
      <ItemListJsonLd />
    </main>
  );
}
