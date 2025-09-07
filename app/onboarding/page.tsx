// app/onboarding/page.tsx
// @ts-nocheck
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PublishMicrositeButton from "@/components/onboarding/PublishMicrositeButton";
import LanguageCard from "@/components/onboarding/LanguageCard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { force?: string };
}) {
  const supabase = await createSupabaseServerClient();

  // Auth check
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect("/login");

  // Lookup profile
  const { data: profile, error } = await supabase
    .from("Providers")
    .select("published, lang_pref")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Allow bypass with ?force=1 (so published users can still access language card)
  const force = searchParams?.force === "1";

  if (!force && !error && profile?.published) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Create your Vyapr microsite</h1>
      <ol className="list-decimal space-y-2 pl-6 text-sm text-gray-700">
        <li>Choose your preferred language.</li>
        <li>Review your details.</li>
        <li>Choose a URL slug (in Settings later).</li>
        <li>Publish your microsite to go live.</li>
      </ol>

      {/* Language selector (client) */}
      <LanguageCard initial={(profile?.lang_pref as any) || "hinglish"} />

      {/* Publish */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-medium">Publish</h2>
        <p className="mt-1 text-sm text-gray-600">
          One click. You can unpublish anytime from the dashboard.
        </p>
        <div className="mt-4">
          <PublishMicrositeButton />
        </div>
      </div>
    </div>
  );
}
