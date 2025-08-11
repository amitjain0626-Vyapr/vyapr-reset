// app/book/[slug]/thank-you/page.tsx
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ThankYouPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params?.slug?.[0] : String(params?.slug ?? '');

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Request received 🎉</h1>
      <p className="text-gray-600 mb-6">
        Thanks for your details. The clinic will reach out shortly to confirm your appointment.
      </p>

      <div className="space-y-3">
        <Link
          href={`/book/${slug}`}
          className="inline-block rounded-xl border px-4 py-2"
        >
          Make another request
        </Link>
        <div className="text-xs text-gray-400">
          Tip: Keep your phone available for a quick confirmation call/WhatsApp.
        </div>
      </div>
    </main>
  );
}
