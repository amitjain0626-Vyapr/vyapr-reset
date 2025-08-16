// app/book/[slug]/page.tsx
// Renders a simple booking form that posts to /api/leads/create
import type { Metadata } from "next";
import LeadForm from "./LeadForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const slug = params.slug;
  return {
    title: `Book with ${slug} | Vyapr`,
    description: `Request an appointment with ${slug} via Vyapr.`,
    robots: { index: true, follow: true },
  };
}

export default function BookPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Request an appointment</h1>
      <p className="text-sm text-gray-600 mb-6">
        Fill your details and we’ll notify the clinic.
      </p>
      <LeadForm slug={slug} />
      <p className="mt-8 text-xs text-gray-500">
        By submitting, you agree to be contacted regarding your booking.
      </p>
    </main>
  );
}
