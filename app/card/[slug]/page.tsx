// app/card/[slug]/page.tsx
// @ts-nocheck
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

const BASE = BRAND.baseUrl;

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const slug = params?.slug || "provider";
  const title = `Digital Card • ${slug} • ${BRAND.name}`;
  const url = `${BASE}/card/${slug}`;
  const bookUrl = `${BASE}/book/${slug}`;
  const ogImage = `${BASE}/api/qr?url=${encodeURIComponent(bookUrl)}`;

  return {
    title,
    description: `Quick-share digital card for ${slug}. Book instantly via ${BRAND.name}.`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description: `Book ${slug} instantly. Live slots & confirmations.`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `QR to book ${slug}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `Book ${slug} instantly. Live slots & confirmations.`,
      images: [ogImage],
    },
  };
}

export default async function Page({ params }: any) {
  const slug = params?.slug || "provider";
  const bookUrl = `${BASE}/book/${slug}`;
  const qrUrl = `${BASE}/api/qr?url=${encodeURIComponent(bookUrl)}`;

  const waText = encodeURIComponent(
    `Namaste! This is my booking link — ${bookUrl}\nLet's get you scheduled. 🙏 — via ${BRAND.name}`
  );
  const waShare = `https://wa.me/?text=${waText}`;

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border p-5 shadow-sm bg-white">
        <h1 className="text-xl font-semibold">Digital Card</h1>
        <p className="mt-1 text-sm text-gray-600">
          Share this with your customers. They can scan the QR or tap the link to book instantly.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          <img
            src={qrUrl}
            alt={`QR to book ${slug}`}
            className="rounded-xl border p-2 bg-white"
            width={220}
            height={220}
          />
          <a
            href={bookUrl}
            className="text-indigo-700 underline break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {bookUrl}
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href={waShare}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 transition"
          >
            💬 Share on WhatsApp
          </a>
          <a
            href={qrUrl}
            download={`korekko-${slug}-booking-qr.png`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-gray-800 bg-white hover:bg-gray-50 transition"
          >
            ⬇️ Download QR
          </a>
        </div>

        <div className="mt-4 text-[12px] text-gray-500">
          Tip: Print this QR on your reception desk or share in WhatsApp Status.
        </div>
      </div>
    </main>
  );
}
