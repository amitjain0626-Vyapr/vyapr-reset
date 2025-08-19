// @ts-nocheck
// app/directory/[combo]/page.tsx
// Directory page that supports `/directory/<category>-<city>`
// Renders dynamic contextual FAQs (Step 9.3 - Part 1).

import DirectoryFaq from "@/components/seo/DirectoryFaq";
import { toTitle } from "@/lib/seo/faq";

// category = before first hyphen, city = rest (supports multi-word cities)
function parseCombo(combo: string): { category: string; city: string } {
  const trimmed = (combo || "").trim();
  const i = trimmed.indexOf("-");
  if (i === -1) return { category: trimmed || "service", city: "city" };
  const category = trimmed.slice(0, i);
  const city = trimmed.slice(i + 1);
  return { category, city };
}

// Keep types loose so we don't fight Next's generated types across versions.
export async function generateMetadata({ params }: any): Promise<any> {
  const { category, city } = parseCombo(params?.combo ?? "");
  const title = `${toTitle(category)} in ${toTitle(city)} | Vyapr Directory`;
  const desc = `Discover and book trusted ${toTitle(category)} providers in ${toTitle(city)}. Compare profiles, chat on WhatsApp, and book online.`;
  const canonical = `/directory/${params?.combo ?? ""}`;

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: { title, description: desc, url: canonical, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function DirectoryPage({ params }: any) {
  const { category, city } = parseCombo(params?.combo ?? "");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">
          {toTitle(category)} in {toTitle(city)}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Compare profiles, chat on WhatsApp, and book online. FAQs below are
          auto‑generated for <strong>{toTitle(category)}</strong> in{" "}
          <strong>{toTitle(city)}</strong>.
        </p>
      </header>

      {/* === Dynamic FAQs + JSON-LD (Step 9.3 - Part 1) === */}
      <DirectoryFaq category={category} city={city} />
    </main>
  );
}
