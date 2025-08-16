// app/d/[slug]/page.tsx
// @ts-nocheck
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: any }): Metadata {
  const slug = params?.slug || "";
  return {
    title: `${slug} | Vyapr`,
    description: `View ${slug}'s microsite on Vyapr.`,
    robots: { index: true, follow: true },
  };
}

export default function MicrositePage({ params }: { params: any }) {
  const slug = params?.slug || "";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Microsite: {slug}</h1>
      {/* TODO: Replace with actual microsite rendering */}
      <p>This is the microsite for <strong>{slug}</strong>.</p>
    </main>
  );
}
