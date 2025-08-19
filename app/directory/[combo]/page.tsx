// @ts-nocheck
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

function toTitle(input) {
  return (input || "")
    .toString()
    .trim()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
function deslugify(s) { return (s || "").replace(/-/g, " ").trim(); }
function parseCombo(combo) {
  const parts = (combo || "").split("-");
  if (parts.length < 2) return { category: "", city: "" };
  const city = parts[parts.length - 1];
  const categorySlug = parts.slice(0, -1).join("-");
  return { category: deslugify(categorySlug), city: deslugify(city) };
}

export async function generateMetadata({ params }) {
  const { combo } = params;
  const { category, city } = parseCombo(combo);
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const url = `${base}/directory/${combo}`;
  const title = `${toTitle(category)} in ${toTitle(city)} — Vyapr Directory`;
  const description = `Discover verified ${category} in ${city}. Browse profiles, view bios, and book on WhatsApp.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function DirectoryPage({ params }) {
  const { combo } = params;
  const { category, city } = parseCombo(combo);
  if (!category || !city) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("Providers")
    .select("id, display_name, slug, category, location, bio, phone, whatsapp, published")
    .eq("published", true)
    .ilike("category", `%${category}%`)
    .ilike("location", `%${city}%`)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);
  const providers = data || [];
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const pageUrl = `${base}/directory/${combo}`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${toTitle(category)} in ${toTitle(city)}`,
    url: pageUrl,
    itemListElement: providers.map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${base}/book/${p.slug}`,
      name: p.display_name || p.slug,
    })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `How do I book a ${category} in ${city}?`,
        acceptedAnswer: { "@type": "Answer", text: `Open any profile and tap “Chat on WhatsApp” or “View profile”.` } },
      { "@type": "Question", name: `What do ${toTitle(category)} typically charge in ${toTitle(city)}?`,
        acceptedAnswer: { "@type": "Answer", text: "Prices vary by experience and service type. Message on WhatsApp for an exact quote." } },
      { "@type": "Question", name: "Are these providers verified?",
        acceptedAnswer: { "@type": "Answer", text: "Profiles show here only when a provider publishes their microsite on Vyapr." } },
    ],
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">
        {toTitle(category)} in {toTitle(city)}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Explore published providers. Tap to view profile or chat on WhatsApp.
      </p>

      {providers.length === 0 ? (
        <>
          <p className="text-sm">No published providers yet. Check back soon.</p>
          <script type="application/ld+json" suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
          <script type="application/ld+json" suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
        </>
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2">
            {providers.map((p) => {
              const name = p.display_name || p.slug;
              const wa = p.whatsapp || p.phone;
              const prefill = encodeURIComponent(
                `Hi ${name}, found you on Vyapr. I’m looking for ${toTitle(p.category)} in ${toTitle(p.location || city)}. Can we chat?`
              );
              const waHref = wa ? `https://wa.me/${wa.replace(/\D/g, "")}?text=${prefill}` : undefined;

              return (
                <li key={p.id} className="rounded-2xl border p-4 hover:shadow-sm">
                  <div className="text-base font-semibold">{name}</div>
                  <div className="text-xs text-gray-500">
                    {toTitle(p.category)} • {toTitle(p.location || city)}
                  </div>
                  {p.bio && <p className="text-sm mt-2 line-clamp-3">{p.bio}</p>}
                  <div className="mt-3 flex gap-3">
                    <Link href={`/book/${p.slug}`} className="inline-block rounded-xl bg-black text-white text-sm px-3 py-2">
                      View profile
                    </Link>
                    {waHref && (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl border text-sm px-3 py-2">
                        Chat on WhatsApp
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <script type="application/ld+json" suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
          {providers.map((p, i) => (
            <script key={i} type="application/ld+json" suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                name: p.display_name || p.slug,
                url: `${base}/book/${p.slug}`,
                description: p.bio || undefined,
                telephone: p.whatsapp || p.phone || undefined,
                address: { "@type": "PostalAddress",
                  addressLocality: p.location || toTitle(city),
                  addressCountry: "IN" },
                areaServed: toTitle(city),
              }) }} />
          ))}
          <script type="application/ld+json" suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
        </>
      )}
    </main>
  );
}
