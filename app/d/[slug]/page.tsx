// @ts-nocheck
import QRCode from "qrcode";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default async function Microsite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const qp = await searchParams;
  const slug = p.slug;

  // fetch provider first
  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug, phone, category_slug, published")
    .eq("slug", slug)
    .single();

  if (!provider) return <div className="p-6">Not found</div>;

  // compute preview AFTER provider exists (fixes "Cannot access 'provider' before initialization")
  const isPreview = !provider.published && qp?.preview === "1";

  // if unpublished and not in preview mode, show message
  if (!provider.published && !isPreview) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center text-gray-600">
        This microsite is not yet published.
        <div className="mt-3">
          <Link href={`/d/${slug}?preview=1`} className="text-teal-700 underline">
            View blurred preview
          </Link>
        </div>
      </div>
    );
  }

  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/book/${provider.slug}`;
  const qr = await QRCode.toDataURL(bookingUrl);

  const waText = encodeURIComponent(
    `Hi ${provider.name}, I found your microsite and want to book a slot.`
  );
  const waLink = provider.phone
    ? `https://wa.me/${provider.phone.replace(/[^0-9]/g, "")}?text=${waText}`
    : null;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{provider.name}</h1>
        <p className="text-gray-500">{provider.category_slug}</p>
      </header>

      {isPreview ? (
        <div className="space-y-3">
          <div className="border rounded p-4">
            <div className="h-28 bg-gray-200 rounded blur-sm" />
            <div className="mt-3 h-4 bg-gray-200 rounded blur-sm" />
            <div className="mt-2 h-4 bg-gray-200 rounded blur-sm w-2/3" />
          </div>
          <p className="text-sm text-gray-500">
            Preview is blurred. Publish to go live.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Welcome to my booking page. Tap below to request a slot, or message me on WhatsApp.
          </p>
          <div className="flex gap-3">
            <Link href={bookingUrl} className="bg-teal-600 text-white px-4 py-2 rounded">
              Book now
            </Link>
            {waLink && (
              <a href={waLink} target="_blank" className="bg-green-600 text-white px-4 py-2 rounded">
                Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <section className="mt-4">
        <h2 className="font-semibold mb-2">Booking QR</h2>
        <img src={qr} alt="Booking QR" className="w-40 h-40" />
        <p className="text-sm text-gray-500 mt-1 break-all">{bookingUrl}</p>
      </section>
    </div>
  );
}
