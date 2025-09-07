// app/dashboard/onboarding/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import OnboardingClient from "@/components/dashboard/OnboardingClient";
import VeliPanel from "@/components/copilot/VeliPanel";

export default async function OnboardingPage(props: any) {
  const spRaw = props?.searchParams;
  const searchParams = spRaw && typeof spRaw.then === "function" ? await spRaw : spRaw || {};
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";

  return (
    <main className="max-w-lg mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome 👋</h1>
          <p className="text-sm text-gray-600">Finish these 3 steps to go live — ~5 minutes.</p>
        </div>
        <VeliPanel slug={slug} provider={slug} />
      </div>

      <Suspense fallback={<div className="rounded-xl border p-4 bg-white text-sm">Loading…</div>}>
        <OnboardingClient slug={slug} />
      </Suspense>
    </main>
  );
}
