// @ts-nocheck
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import QRCode from "qrcode";

export default async function MicrositePreview({ params, searchParams }) {
  const supabase = createClientComponentClient();

  // Fetch provider
  const { data: provider } = await supabase
    .from("providers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!provider) {
    return <div>Provider not found</div>;
  }

  const isPreview = searchParams.preview === "1";

  // Generate QR code pointing to booking link
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/book/${provider.id}`;
  const qrDataUrl = await QRCode.toDataURL(bookingUrl);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{provider.name}</h1>
      <p className="text-gray-500">{provider.category_slug}</p>

      {isPreview && (
        <div className="mt-4 p-4 bg-gray-100 border rounded">
          <p className="blur-sm">[Blurred Microsite Preview]</p>
          <p className="text-sm text-gray-400 mt-2">
            Complete your profile to unblur your site.
          </p>
        </div>
      )}

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Booking QR</h2>
        <img src={qrDataUrl} alt="Booking QR" className="w-40 h-40" />
        <p className="text-sm text-gray-500 mt-1">{bookingUrl}</p>
      </div>
    </div>
  );
}
