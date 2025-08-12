// app/d/[slug]/page.tsx
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Link from "next/link";
import SafeImg from "@/components/ui/SafeImg";

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } }
  );
}

function hasHttpUrl(u?: string | null) {
  return typeof u === "string" && /^https?:\/\//i.test(u.trim());
}
function telHref(raw?: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export default async function MicrositePage({ params }) {
  const supabase = supabaseServer();

  const { data: dentist } = await supabase
    .from("Dentists")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!dentist || !dentist.is_published) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="text-4xl mb-4">🦷</div>
        <h1 className="text-2xl font-semibold mb-2">Microsite not found</h1>
        <p className="text-gray-600">This page doesn’t exist or hasn’t been published yet.</p>
      </div>
    );
  }

  const profileOk = hasHttpUrl(dentist.profile_image_url);
  const clinicOk = hasHttpUrl(dentist.clinic_image_url);
  const phoneHref = telHref(dentist.phone);
  const website = hasHttpUrl(dentist.website) ? dentist.website : null;
  const maps = hasHttpUrl(dentist.google_maps_link) ? dentist.google_maps_link : null;

  return (
    <main className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <header className="flex flex-col items-center text-center">
        {profileOk ? (
          <SafeImg
            src={dentist.profile_image_url}
            alt={dentist.name || "Profile"}
            className="w-32 h-32 rounded-full object-cover border mb-4"
            fallback={
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-4xl mb-4">
                🦷
              </div>
            }
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-4xl mb-4">
            🦷
          </div>
        )}

        <h1 className="text-3xl font-bold">{dentist.name}</h1>
        {dentist.city && <p className="text-gray-700">{dentist.city}</p>}
        {dentist.address_line1 && (
          <p className="text-gray-600">
            {dentist.address_line1} {dentist.address_line2 || ""}
          </p>
        )}

        {maps && (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline mt-2"
          >
            📍 View on Google Maps
          </a>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <Link
            href={`/book/${encodeURIComponent(dentist.slug)}`}
            className="btn-primary no-underline inline-flex items-center"
          >
            🗓️ Book Appointment
          </Link>
          {phoneHref && (
            <a href={phoneHref} className="btn no-underline inline-flex items-center">
              📞 Call
            </a>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn no-underline inline-flex items-center"
            >
              🌐 Website
            </a>
          )}
        </div>
      </header>

      {/* Clinic banner */}
      {clinicOk && (
        <div className="mt-6">
          <SafeImg
            src={dentist.clinic_image_url}
            alt="Clinic"
            className="w-full rounded-2xl object-cover border max-h-80"
            fallback={null}
          />
        </div>
      )}

      {/* About */}
      {dentist.about && (
        <section className="mt-8 card p-6">
          <h2 className="text-xl font-semibold mb-2">About</h2>
          <p className="leading-7">{dentist.about}</p>
        </section>
      )}

      {/* Services */}
      {dentist.services && (
        <section className="mt-6 card p-6">
          <h2 className="text-xl font-semibold mb-2">Services</h2>
          <p className="leading-7 whitespace-pre-line">{dentist.services}</p>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by <Link href="/" className="underline">Vyapr</Link> • microsite
      </footer>
    </main>
  );
}
