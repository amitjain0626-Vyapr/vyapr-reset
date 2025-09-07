// app/reviews/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import ReviewRequestCard from "@/components/reviews/ReviewRequestCard";

type Provider = { id: string; slug: string; display_name?: string | null } | null;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getProviderBySlugSafe(slug: string): Promise<Provider> {
  try {
    if (!slug) return null;
    const { data, error } = await admin()
      .from("Providers")
      .select("id, slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data?.id) return null;
    return { id: data.id, slug: data.slug, display_name: data.display_name };
  } catch {
    return null;
  }
}

export default async function ReviewsPage(props: any) {
  const spRaw = props?.searchParams;
  const searchParams =
    spRaw && typeof spRaw.then === "function" ? await spRaw : spRaw || {};
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";
  const provider = await getProviderBySlugSafe(slug);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Request Reviews</h1>
          <p className="text-sm text-gray-600">
            Ready-to-send texts with your unique review link.
          </p>
        </div>
        {slug ? (
          <div className="text-xs text-gray-500">
            Provider: <code>{provider?.display_name || slug}</code>
          </div>
        ) : null}
      </header>

      <ReviewRequestCard
        slug={slug}
        providerId={provider?.id || null}
        providerName={provider?.display_name || slug}
        lang="en"
        tone="casual"
      />

      <ReviewRequestCard
        slug={slug}
        providerId={provider?.id || null}
        providerName={provider?.display_name || slug}
        lang="hi"
        tone="formal"
      />
    </main>
  );
}
