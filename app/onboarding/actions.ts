// app/onboarding/actions.ts
// @ts-nocheck
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Save provider's language preference + fire telemetry.
 */
export async function saveLang(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error("not_authenticated");

  const lang = String(formData.get("lang_pref") || "hinglish");

  // Update provider profile
  const { data: profile } = await supabase
    .from("Providers")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  await supabase
    .from("Providers")
    .update({ lang_pref: lang })
    .eq("owner_id", user.id);

  // Fire telemetry
  await supabase.from("Events").insert({
    event: "provider.lang.chosen",
    ts: Date.now(),
    provider_id: profile?.id || null,
    lead_id: null,
    source: { via: "web", lang },
  });
}
