// app/directory/page.tsx
// @ts-nocheck
import Link from "next/link";
import T from "@/components/i18n/T";
import LanguageToggle from "@/components/i18n/LanguageToggle";

// --- Config: feature combos to show on the index ---
// Keep this tiny & static for now; later we can fetch from DB if needed.
// Only published providers should be discoverable on combo pages (already gated there).
const FEATURED_COMBOS: Array<{ combo: string; labelEn: string; labelHi: string; blurbEn: string; blurbHi: string }> = [
  { combo: "dance-pune",        labelEn: "Dance teachers in Pune",        labelHi: "Pune mein Dance teachers",        blurbEn: "Find trained dance instructors near you",                 blurbHi: "Aapke paas trained dance instructors dhoondhiye" },
  { combo: "yoga-delhi",        labelEn: "Yoga trainers in Delhi",        labelHi: "Delhi mein Yoga trainers",        blurbEn: "Beginner to advanced, home & studio sessions",            blurbHi: "Beginner se advanced, home aur studio sessions" },
  { combo: "music-bangalore",   labelEn: "Music teachers in Bengaluru",   labelHi: "Bengaluru mein Music teachers",   blurbEn: "Vocal & instrumental classes for all ages",                blurbHi: "Har umar ke liye vocal & instrumental classes" },
  { combo: "makeup-mumbai",     labelEn: "Makeup artists in Mumbai",      labelHi: "Mumbai mein Makeup artists",      blurbEn: "Party, bridal & editorial looks",                          blurbHi: "Party, bridal & editorial looks" },
  { combo: "tutors-delhi",      labelEn: "Home tutors in Delhi",          labelHi: "Delhi mein Home tutors",          blurbEn: "Academic coaching across classes & boards",               blurbHi: "Har class & board ke liye academic coaching" },
  { combo: "astrologers-pune",  labelEn: "Astrologers in Pune",           labelHi: "Pune mein Astrologers",           blurbEn: "Tarot, Vedic, and horoscope consultations",               blurbHi: "Tarot, Vedic, aur horoscope consultations" },
];

// Helpers
const site = process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app";
const url = `${site}/directory`;

function BreadcrumbsJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${site}/` },
      { "@type": "ListItem", "position": 2, "name": "Directory", "item": url }
    ]
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function ItemListJsonLd() {
  const items = FEATURED_COMBOS.map((c, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": c.labelEn, // keep English in structured data for consistency
    "url": `${site}/directory/${c.combo}`
  }));
  const data = { "@context": "https://schema.org", "@type": "ItemList", "itemListElement": items };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export const metadata = {
  title: "Directory — Korekko",
  description: "Explore featured category–city pages to find local providers on Korekko.",
  alternates: { canonical: url },
};

export default function DirectoryIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Lang toggle */}
      <div className="flex items-center justify-end">
        <LanguageToggle />
      </div>

      {/* Visible breadcrumbs (UI only) */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6 mt-3">
        <ol className="flex gap-2 text-gray-600">
          <li><Link href="/" className="hover:underline"><T en="Home" hi="Home" /></Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium"><T en="Directory" hi="Directory" /></li>
        </ol>
      </nav>

      <h1 className="text-2xl md:text-3xl font-semibold mb-2">
        <T en="Explore providers by city & category" hi="Sheher aur category ke hisaab se providers dhoondhiye" />
      </h1>
      <p className="text-gray-600 mb-8">
        <T
          en="Jump into our most requested combos. Each page lists published providers only."
          hi="Sabse zyada maange gaye combos se shuru kijiye. Har page par sirf published providers dikhte hain."
        />
      </p>

      {/* Grid of featured combos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURED_COMBOS.map(({ combo, labelEn, labelHi, blurbEn, blurbHi }) => (
          <Link
            key={combo}
            href={`/directory/${combo}`}
            className="block rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <h2 className="text-lg font-medium"><T en={labelEn} hi={labelHi} /></h2>
            <p className="text-sm text-gray-600 mt-1"><T en={blurbEn} hi={blurbHi} /></p>
            <span className="inline-block mt-3 text-sm underline">
              <T en={`View ${combo.replace("-", " ")} →`} hi={`Dekhiye ${combo.replace("-", " ")} →`} />
            </span>
          </Link>
        ))}
      </section>

      {/* JSON-LD */}
      <BreadcrumbsJsonLd />
      <ItemListJsonLd />
    </main>
  );
}
