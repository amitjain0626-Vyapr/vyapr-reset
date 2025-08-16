// app/book/[slug]/page.tsx
import type { Metadata } from "next";
import LeadForm from "./LeadForm";

export const dynamic = "force-dynamic";

// Correct typing: let Next.js inject params
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const slug = params.slug;
  return {
    title: `Book with ${slug} | Vyapr`,
    description: `Request an appointment with ${slug} via Vyapr.`,
    robots: { index: true, follow: true },
  };
}

export default function BookPage(props: any) {
  const { slug } = props.params;
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
