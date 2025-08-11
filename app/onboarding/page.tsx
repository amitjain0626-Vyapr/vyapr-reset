cat > app/onboarding/page.tsx <<'EOF'
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ProfileForm from "../../components/onboarding/ProfileForm";
import { getServerSupabase } from "../../lib/supabase/server";

async function loadInitial() {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("Dentists")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export default async function OnboardingPage() {
  const initial = await loadInitial();

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="text-sm text-gray-600">
          Update your public profile and publish your microsite.
        </p>
      </div>

      <ProfileForm initial={initial} />

      <div className="text-xs text-gray-500">
        Tip: After publishing, your link will be {initial?.slug ? <code>/d/{initial.slug}</code> : "visible after you set a slug"}.
      </div>
    </main>
  );
}
EOF