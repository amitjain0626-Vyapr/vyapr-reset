// app/directory/[combo]/page.tsx
// @ts-nocheck
import Link from "next/link";

type Provider = {
  slug: string;
  display_name: string | null;
  category: string | null;
  location: string | null;
  whatsapp: string | null;
  bio: string | null;
};

export const revalidate = 600;

function toTitle(s: string) {
  return (s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function ComboPage({ params }: { params: Promise<{ combo: string }> }) {
  const { combo } = await params;
  const [categorySlug, citySlug] = (combo || "").split("-");
  const category = toTitle(categorySlug || "");
  const city = toTitle(citySlug || "");

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("Providers")
    .select("slug, display_name, category, location, whatsapp, bio")
    .eq("published", true)
    .ilike("category", category)
    .ilike("location", city)
    .limit(60);

  const providers: Provider[] = (!error && Array.isArray(data)) ? data : [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";

  // JSON-LD helpers
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Directory", item: `${baseUrl}/directory` },
      { "@type": "ListItem", position: 3, name: `${category} in ${city}`, item: `${baseUrl}/directory/${combo}` },
    ],
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: providers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.display_name || p.slug,
      url: `${baseUrl}/book/${p.slug}`,
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* NEW: Back link strengthens internal linking */}
      <nav className="mb-4 text-sm">
        <Link href="/directory" className="inline-flex items-center gap-1 text-gray-600 hover:underline">
          ← Back to Directory
        </Link>
      </nav>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
        {category} in {city}
      </h1>
      <p className="mt-2 text-gray-600">
        Book trusted providers. Click a profile to view details and WhatsApp them directly.
      </p>

      {providers.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-6">
          <p className="text-gray-700">
            We’re adding providers here. Try another city or check back soon.
          </p>
          <div className="mt-3">
            <Link href="/directory" className="text-sm text-blue-700 underline">
              Browse all categories × cities
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <Link
              key={p.slug}
              href={`/book/${p.slug}`}
              className="group rounded-2xl border p-4 hover:shadow-sm transition"
            >
              <div className="text-base font-medium group-hover:underline">
                {p.display_name || p.slug}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {p.category || category} • {p.location || city}
              </div>
              {p.bio && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.bio}</p>}
            </Link>
          ))}
        </div>
      )}

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
    </main>
  );
}
