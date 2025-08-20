// app/directory/[combo]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

// Next 15: params is a Promise — await it in the page
export default async function DirectoryComboPage({ params }: { params: Promise<{ combo: string }> }) {
  const { combo } = await params;
  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  // Parse combo -> category, city
  const [rawCat = "", rawCity = ""] = String(combo || "").split("-");
  const titleCat = unslugify(rawCat);
  const titleCity = unslugify(rawCity);
  const pageTitle = `${titleCat} in ${titleCity}`;

  // Fetch providers (published) matching category+location — case/space tolerant
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: rows, error } = await supabase
    .from("Providers")
    .select("slug, display_name, category, location, bio")
    .eq("published", true)
    .ilike("category", likeify(rawCat))
    .ilike("location", likeify(rawCity));

  const providers = Array.isArray(rows) ? rows.filter(r => r?.slug) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* breadcrumbs (UI) */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex gap-2 text-gray-600">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/directory" className="hover:underline">Directory</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium">{pageTitle}</li>
        </ol>
      </nav>

      <h1 className="text-2xl md:text-3xl font-semibold mb-2">{pageTitle}</h1>
      <p className="text-gray-600 mb-8">Published providers only. Click a card to view their booking page.</p>

      {/* cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.length > 0 ? (
          providers.map(p => (
            <Link
              key={p.slug}
              href={`/book/${p.slug}`}
              className="block rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <h2 className="text-lg font-medium">{p.display_name || p.slug}</h2>
              <p className="text-sm text-gray-600 mt-1">{prettyCatLoc(p.category, p.location)}</p>
              {p.bio ? <p className="text-sm text-gray-500 line-clamp-2 mt-1">{p.bio}</p> : null}
              <span className="inline-block mt-3 text-sm underline">Open profile →</span>
            </Link>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-gray-600">
            No published providers yet for {pageTitle}. Check back soon.
          </div>
        )}
      </section>

      {/* JSON-LD: BreadcrumbList + ItemList */}
      <BreadcrumbsJsonLd site={site} combo={combo} titleCat={titleCat} titleCity={titleCity} />
      <ItemListJsonLd site={site} providers={providers} />
    </main>
  );
}

/* ---------- helpers ---------- */

function unslugify(s: string) {
  const t = String(s || "").replace(/-/g, " ").trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : "";
}

function likeify(s: string) {
  // turn "dance" -> "%dance%" ; tolerate spaces vs dashes
  const v = String(s || "").replace(/-/g, " ").trim();
  return v ? `%${v}%` : "%";
}

function prettyCatLoc(cat?: string, loc?: string) {
  const C = (cat || "").trim();
  const L = (loc || "").trim();
  if (C && L) return `${C} — ${L}`;
  return C || L || "";
}

function BreadcrumbsJsonLd({ site, combo, titleCat, titleCity }: { site: string; combo: string; titleCat: string; titleCity: string; }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
      { "@type": "ListItem", position: 2, name: "Directory", item: `${site}/directory` },
      { "@type": "ListItem", position: 3, name: `${titleCat} in ${titleCity}`, item: `${site}/directory/${combo}` },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function ItemListJsonLd({ site, providers }: { site: string; providers: Array<any>; }) {
  const items = (providers || []).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.display_name || p.slug,
    url: `${site}/book/${p.slug}`,
  }));
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export async function generateMetadata({ params }: { params: Promise<{ combo: string }> }) {
  const { combo } = await params;
  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const [rawCat = "", rawCity = ""] = String(combo || "").split("-");
  const title = `${unslugify(rawCat)} in ${unslugify(rawCity)} — Vyapr`;
  const canonical = `${site}/directory/${combo}`;
  return {
    title,
    description: `Browse published ${unslugify(rawCat).toLowerCase()} providers in ${unslugify(rawCity)}.`,
    alternates: { canonical },
  };
}
