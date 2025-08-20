// app/directory/page.tsx
// @ts-nocheck
import Link from "next/link";
import SeoBreadcrumbs from "@/components/SeoBreadcrumbs";

export const revalidate = 600; // refresh every 10 min

type Combo = {
  category: string;
  city: string;
  url: string;
  count: number;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function comboPath(category: string, city: string) {
  return `/directory/${slugify(category)}-${slugify(city)}`;
}

async function getLiveCombos(): Promise<Combo[]> {
  // createSupabaseServerClient exists per project rules
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  // Public RLS: Providers.published = true
  const { data, error } = await supabase
    .from("Providers")
    .select("category, location", { head: false })
    .eq("published", true);

  if (error || !data) return [];

  const map = new Map<string, Combo>();

  for (const row of data as any[]) {
    const category = (row.category || "").toString().trim();
    const city = (row.location || "").toString().trim();
    if (!category || !city) continue;

    const key = `${category}|||${city}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    map.set(key, {
      category,
      city,
      url: comboPath(category, city),
      count: 1,
    });
  }

  // Sort by provider count desc, then category asc
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, 100); // safety cap
}

/** JSON-LD builders kept local to preserve behavior */
function BreadcrumbsJSONLD(baseUrl: string) {
  const base = (baseUrl || "https://vyapr-reset-5rly.vercel.app").replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Directory", item: `${base}/directory` },
    ],
  };
}

function ItemListJSONLD(baseUrl: string, combos: Combo[]) {
  const base = (baseUrl || "https://vyapr-reset-5rly.vercel.app").replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: combos.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${c.category} in ${c.city}`,
      url: `${base}${c.url}`,
    })),
  };
}

export const metadata = {
  title: "Directory | Vyapr",
  description:
    "Explore top service categories across cities on Vyapr — quick booking and WhatsApp contact for solo providers.",
};

export default async function DirectoryIndexPage() {
  const combos = await getLiveCombos();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Hidden QA marker */}
      <div className="sr-only" data-marker="VYAPR-DIR-9.6">VYAPR-DIR-9.6</div>

      {/* Shared breadcrumb component (visual + BreadcrumbList JSON-LD) */}
      <SeoBreadcrumbs
        baseUrl={baseUrl}
        trail={[{ name: "Home", url: "/" }, { name: "Directory" }]}
        className="mb-4"
      />

      {/* Legacy visual crumbs (kept to avoid behavior change) */}
      <section className="mb-6 text-sm text-gray-500">
        <nav className="flex items-center gap-2" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline">Home</Link>
          <span aria-hidden>›</span>
          <span className="text-gray-700 font-medium">Directory</span>
        </nav>
      </section>

      <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
      <p className="mt-2 text-gray-600">
        Browse popular <span className="font-medium">categories × cities</span> with live providers.
      </p>

      {combos.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-6">
          <p className="text-gray-700">
            We’re preparing categories. Check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {combos.map((c) => (
              <Link
                key={`${c.category}-${c.city}`}
                href={c.url}
                className="group rounded-2xl border p-4 hover:shadow-md transition"
              >
                <div className="text-base font-medium group-hover:underline">
                  {c.category} in {c.city}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {c.count} provider{c.count > 1 ? "s" : ""}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold">Don’t see your city?</h2>
            <p className="text-sm text-gray-600">
              Publish your microsite from your dashboard — new combos appear here automatically.
            </p>
          </div>
        </>
      )}

      {/* JSON-LD scripts (BreadcrumbList + ItemList) */}
      <script
        id="ld-dir-breadcrumbs"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BreadcrumbsJSONLD(baseUrl)) }}
      />
      <script
        id="ld-dir-itemlist"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ItemListJSONLD(baseUrl, combos)) }}
      />
    </main>
  );
}
