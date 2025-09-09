// app/d/[slug]/page.tsx
// @ts-nocheck
import type { Metadata } from "next";
import { BRAND, COPY } from "@/lib/brand";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: any }): Metadata {
  const slug = params?.slug || "";
  return {
    // e.g., "amit | Korekko Microsite"
    title: `${slug} | ${COPY.micrositeName}`,
    // e.g., "View amit's microsite on Korekko."
    description: `View ${slug}'s microsite on ${BRAND.name}.`,
    robots: { index: true, follow: true },
  };
}

export default function MicrositePage({ params }: { params: any }) {
  const slug = params?.slug || "";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">
        {COPY.micrositeName}: {slug}
      </h1>
      {/* TODO: Replace with actual microsite rendering */}
      <p>
        This is the microsite for <strong>{slug}</strong>.
      </p>
      <p className="mt-4 text-sm opacity-70">{COPY.verifiedBy}</p>
    </main>
  );
}
