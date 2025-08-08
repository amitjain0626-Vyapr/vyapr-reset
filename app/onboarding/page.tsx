// @ts-nocheck
import OnboardingApp from "@/components/onboarding/OnboardingApp";
import SignOutButton from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <SignOutButton />
      </div>
      <p className="text-sm text-gray-600 mb-6">Let’s set up your profile and microsite.</p>
      <OnboardingApp />
    </main>
  );
}
