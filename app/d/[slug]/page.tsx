// @ts-nocheck
// app/d/[slug]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";

/**
 * Matches your actual Dentists schema (from your debug JSON):
 * id, slug, name, phone, about, bio, specialization, address_line1, address_line2, city,
 * profile_image_url, clinic_image_url, website, google_maps_link,
 * published, is_published, services, etc.
 */

type DentistRow = {
  id: string;
  slug?: string | null;
  name?: string | null;
  phone?: string | null;
  about?: string | null;
  bio?: string | null;
  specialization?: string | null;
  whatsapp?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  profile_image_url?: string | null;  // avatar
  clinic_image_url?: string | null;   // cover
  website?: string | null;
  google_maps_link?: string | null;
  razorpay_link?: string | null;
  published?: boolean | null;
  is_published?: boolean | null;
  services?: string | null;           // CSV or JSON text
};

function normServices(s: any): string[] {
  if (!s) return [];
  try {
    if (Array.isArray(s)) return s.map(String).filter(Boolean).slice(0, 20);
    const txt = String(s);
    const maybe = JSON.parse(txt);
    if (Array.isArray(maybe)) return maybe.map(String).filter(Boolean).slice(0, 20);
    return txt.split(/[;,|]\s*/g).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  } catch {
    return String(s).split(/[;,|]\s*/g).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  }
}

async function loadDentist(slug: string) {
  const supabase = getServerSupabase();
  const cleanSlug = slug.trim().toLowerCase();

  const { data, error } = await supabase
    .from("Dentists")
    .select(
      "id,slug,name,phone,about,bio,specialization,address_line1,address_line2,city,profile_image_url,clinic_image_url,website,google_maps_link,razorpay_link,published,is_published,services"
    )
    // Case-insensitive slug match (handles /d/Dr-Kapoor etc.)
    .ilike("slug", cleanSlug)
    // Published rows only; row-level security may also enforce this
    .or("published.eq.true,is_published.eq.true")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DentistRow;
}

export default async function DentistPublicPage(props: any) {
  // Next 15 can pass params as a Promise — support both
  const raw = props?.params;
  const params = raw && typeof raw.then === "function" ? await raw : raw;
  const slug: string | undefined = params?.slug;
  if (!slug) notFound();

  const row = await loadDentist(slug);
  if (!row) notFound();

  const name = row.name ?? "Your Dentist";
  const tagline = row.specialization?.toString() || "Dental care made simple";
  const about = row.about ?? row.bio ?? "";
  const services = normServices(row.services);

  const phone = (row.phone ?? "").trim();
  const waNum = (row.whatsapp ?? phone).replace(/[^\d]/g, "");
  const waMsg = encodeURIComponent(`Hi ${name}, I'd like to book an appointment. (via Vyapr)`);
  const waLink = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : "";

  const maps = row.google_maps_link ?? "";
  const pay  = row.razorpay_link ?? "";
  const website = row.website ?? "";

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <div className="relative w-full h-48 md:h-64 bg-gray-100">
        {row.clinic_image_url ? (
          <Image src={row.clinic_image_url} alt={`${name} clinic`} fill className="object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4">
          {row.profile_image_url ? (
            <Image
              src={row.profile_image_url}
              alt={`${name} photo`}
              width={84}
              height={84}
              className="rounded-2xl border bg-white shadow"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white border grid place-items-center text-xl shadow">🦷</div>
          )}
          <div className="text-white drop-shadow">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <p className="text-sm opacity-95">{tagline}</p>
            {(row.address_line1 || row.city) ? (
              <p className="text-xs opacity-90 mt-1">
                {row.address_line1 ?? ""}{row.address_line2 ? `, ${row.address_line2}` : ""}{row.city ? ` • ${row.city}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-8">
        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          {waLink ? (
            <a href={waLink} target="_blank" className="px-4 py-2 rounded-xl border hover:bg-gray-50">
              💬 Book on WhatsApp
            </a>
          ) : null}
          {phone ? (
            <a href={`tel:${phone}`} className="px-4 py-2 rounded-xl border hover:bg-gray-50">📞 Call</a>
          ) : null}
          {maps ? (
            <a href={maps} target="_blank" className="px-4 py-2 rounded-xl border hover:bg-gray-50">🗺️ Directions</a>
          ) : null}
          {website ? (
            <a href={website} target="_blank" className="px-4 py-2 rounded-xl border hover:bg-gray-50">🌐 Website</a>
          ) : null}
          {pay ? (
            <a href={pay} target="_blank" className="px-4 py-2 rounded-xl border hover:bg-gray-50">💳 Pay / Book</a>
          ) : null}
        </div>

        {/* About */}
        {about || row.address_line1 || row.city ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About</h2>
            {about ? <p className="text-sm leading-6 whitespace-pre-line">{about}</p> : null}
            {(row.address_line1 || row.city) ? (
              <p className="text-sm text-gray-600">
                {row.address_line1 ?? ""}{row.address_line2 ? `, ${row.address_line2}` : ""}{row.city ? ` • ${row.city}` : ""}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Services */}
        {services.length ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Services</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services.map((s, i) => (
                <li key={i} className="px-3 py-2 border rounded-lg">{s}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Footer */}
        <footer className="pt-6 text-xs text-gray-500">
          Powered by Vyapr • microsite
        </footer>
      </div>
    </main>
  );
}
