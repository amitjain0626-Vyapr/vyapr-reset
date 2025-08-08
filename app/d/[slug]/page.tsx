// @ts-nocheck
import { notFound } from "next/navigation";
import BookingForm from "@/components/leads/BookingForm";
import { createSupabaseServerClient } from "@/app/utils/supabase/server";

export const dynamic = "force-dynamic";

// SEO: dynamic <title>, <meta>, OG/Twitter
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = await createSupabaseServerClient();
  const slug = (params?.slug || "").toLowerCase();

  const { data: dentist } = await supabase
    .from("Dentists")
    .select(
      "name, about, city, state, pincode, profile_image_url, clinic_image_url, is_published, slug, updated_at"
    )
    .ilike("slug", slug)
    .maybeSingle();

  if (!dentist || !dentist.is_published) {
    return {
      title: "Dentist not found • Vyapr",
      description: "This microsite is not available.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${dentist.name || "Dentist"} • ${dentist.city || "Clinic"} | Book Online`;
  const desc =
    (dentist.about || "")
      .replace(/\s+/g, " ")
      .slice(0, 160) || `Book an appointment with ${dentist.name || "the dentist"} online.`;
  const canonical = `/d/${dentist.slug}`;
  const ogImages = [
    dentist.clinic_image_url || dentist.profile_image_url || `/api/placeholder/1200x630`,
    `/d/${dentist.slug}/opengraph-image`,
  ];

  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title,
      description: desc,
      type: "website",
      url: canonical,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: ogImages,
    },
    other: {
      "last-modified": dentist.updated_at ? new Date(dentist.updated_at).toUTCString() : undefined,
    },
  };
}

export default async function MicrositePage({ params }: { params: { slug: string } }) {
  const supabase = await createSupabaseServerClient();

  const slug = (params?.slug || "").toLowerCase();

  const { data: dentist } = await supabase
    .from("Dentists")
    .select(
      "id, name, about, city, state, pincode, profile_image_url, clinic_image_url, hours, services, is_published, slug"
    )
    .ilike("slug", slug)
    .maybeSingle();

  if (!dentist || !dentist.is_published) {
    notFound();
  }

  // JSON-LD Schema.org (Dentist + LocalBusiness)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dentist",
    name: dentist.name || "Dentist",
    image: dentist.profile_image_url || undefined,
    description: dentist.about || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: dentist.city || undefined,
      addressRegion: dentist.state || undefined,
      postalCode: dentist.pincode || undefined,
      addressCountry: "IN",
    },
    url: `/d/${dentist.slug}`,
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="flex items-start gap-6 mb-8">
        {dentist.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dentist.profile_image_url}
            alt={dentist.name || "Profile"}
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold">{dentist.name || "Dentist"}</h1>
          <p className="text-sm text-gray-600">
            {dentist.city || ""}{dentist.city && dentist.state ? ", " : ""}{dentist.state || ""} {dentist.pincode || ""}
          </p>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {dentist.clinic_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dentist.clinic_image_url}
              alt="Clinic"
              className="w-full rounded-2xl object-cover"
            />
          ) : null}
          {dentist.about ? <p className="text-base">{dentist.about}</p> : null}

          {Array.isArray(dentist.services) && dentist.services?.length > 0 ? (
            <div>
              <h2 className="text-lg font-medium mb-1">Services</h2>
              <ul className="list-disc ml-5">
                {dentist.services.map((s: any, i: number) => (
                  <li key={i}>{typeof s === "string" ? s : s?.name || "-"}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {dentist.hours ? (
            <div>
              <h2 className="text-lg font-medium mb-1">Hours</h2>
              <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(dentist.hours, null, 2)}</pre>
            </div>
          ) : null}
        </div>

        <aside className="md:col-span-1 border rounded-2xl p-4 h-fit">
          <h2 className="text-lg font-medium mb-2">Book a visit</h2>
          <BookingForm slug={dentist.slug} />
        </aside>
      </section>
    </main>
  );
}
