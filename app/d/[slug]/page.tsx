// app/d/[slug]/page.tsx
// @ts-nocheck

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";

export const revalidate = 60;

type Dentist = {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  about: string | null;
  services: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  google_maps_link: string | null;
  razorpay_payment_link: string | null;
  ondc_store_link: string | null;
  profile_image_url: string | null;
  clinic_image_url: string | null;
  slug: string;
  is_published: boolean | null;
};

function supabaseServer() {
  // Safe in RSC: provide no-op setters to avoid cookie mutation errors
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

function telHref(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function waHref(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Default to 91 if user typed a 10-digit Indian mobile
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCc}`;
}

export default async function Page({ params }: { params: { slug: string } }) {
  const supabase = supabaseServer();

  const { data: dentist, error } = await supabase
    .from("Dentists")
    .select(
      "id,name,city,address,about,services,clinic_name,clinic_address,phone,whatsapp_number,website_url,google_maps_link,razorpay_payment_link,ondc_store_link,profile_image_url,clinic_image_url,slug,is_published"
    )
    .eq("slug", params.slug)
    .eq("is_published", true)
    .maybeSingle<Dentist>();

  if (error || !dentist) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-4xl mb-2">🦷</div>
          <h1 className="text-xl font-semibold">Microsite not found</h1>
          <p className="text-sm text-gray-500 mt-2">
            The page you’re looking for doesn’t exist or isn’t published yet.
          </p>
        </div>
      </main>
    );
  }

  const phoneHref = telHref(dentist.phone);
  const waLink = waHref(dentist.whatsapp_number || dentist.phone);
  const website = dentist.website_url?.startsWith("http")
    ? dentist.website_url
    : dentist.website_url
    ? `https://${dentist.website_url}`
    : null;
  const maps = dentist.google_maps_link?.startsWith("http")
    ? dentist.google_maps_link
    : null;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Card */}
      <section className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        {/* Hero */}
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            {/* Profile image */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-gray-100 border flex items-center justify-center">
              {dentist.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dentist.profile_image_url}
                  alt={dentist.name || "Dentist"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl">🦷</span>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
                {dentist.name || "Dentist"}
              </h1>
              <div className="mt-1 text-sm text-gray-600">
                {dentist.city || ""}
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                  >
                    💬 Book on WhatsApp
                  </a>
                )}
                {phoneHref && (
                  <a
                    href={phoneHref}
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                  >
                    📞 Call
                  </a>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                  >
                    🌐 Website
                  </a>
                )}
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                  >
                    🗺️ Get Directions
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Address line */}
          {(dentist.address || dentist.clinic_address) && (
            <div className="mt-4 text-sm text-gray-700">
              {dentist.clinic_address || dentist.address}
            </div>
          )}
        </div>

        {/* Clinic banner */}
        {dentist.clinic_image_url && (
          <div className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dentist.clinic_image_url}
              alt={dentist.clinic_name || "Clinic"}
              className="w-full max-h-80 object-cover"
            />
          </div>
        )}

        {/* Body */}
        <div className="p-6 md:p-8">
          {dentist.about && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold">About</h2>
              <p className="mt-2 text-sm leading-6 text-gray-700 whitespace-pre-line">
                {dentist.about}
              </p>
            </section>
          )}

          {(dentist.services && dentist.services.trim().length > 0) && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold">Services</h2>
              <p className="mt-2 text-sm leading-6 text-gray-700 whitespace-pre-line">
                {dentist.services}
              </p>
            </section>
          )}

          {/* Payment / ONDC buttons (only when links exist) */}
          <div className="flex flex-wrap gap-2">
            {dentist.razorpay_payment_link && (
              <a
                href={
                  dentist.razorpay_payment_link.startsWith("http")
                    ? dentist.razorpay_payment_link
                    : `https://${dentist.razorpay_payment_link}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
              >
                💳 Pay/Book Online
              </a>
            )}
            {dentist.ondc_store_link && (
              <a
                href={
                  dentist.ondc_store_link.startsWith("http")
                    ? dentist.ondc_store_link
                    : `https://${dentist.ondc_store_link}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
              >
                🛒 Visit ONDC Store
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 md:p-8 text-xs text-gray-500 flex items-center justify-between">
          <span>
            Powered by <span className="font-medium">Vyapr</span> • microsite
          </span>
          <Link href="/" className="underline">Create your site</Link>
        </div>
      </section>
    </main>
  );
}
