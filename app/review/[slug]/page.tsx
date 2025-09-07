// app/review/[slug]/page.tsx
// @ts-nocheck
export const runtime = "nodejs";

import ReviewLanding from "./ReviewLanding";

export default async function ReviewSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ReviewLanding slug={slug} />;
}