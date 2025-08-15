// @ts-nocheck
"use server";

import { cookies } from "next/headers";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function submitOnboarding(formData: FormData) {
  const supabase = createServerActionClient({ cookies }); // <-- critical
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "AUTH_USER_ERROR", message: "Unable to read session user.", details: "Auth session missing!" };
  }

  const name = String(formData.get("name") || "");
  const phone = String(formData.get("phone") || "");
  const category = String(formData.get("category") || "");
  const slug = String(formData.get("slug") || "");

  if (!name || !phone || !slug) {
    return { ok: false, error: "Missing required fields" };
  }

  const { data: prov, error: provErr } = await admin
    .from("providers")
    .upsert({ owner_id: user.id, name, phone, category, slug }, { onConflict: "owner_id" })
    .select("id, slug")
    .maybeSingle();
  if (provErr || !prov) return { ok: false, error: provErr?.message || "provider upsert failed" };

  const { error: msErr } = await admin
    .from("microsites")
    .upsert({ provider_id: prov.id, slug }, { onConflict: "provider_id" });
  if (msErr) return { ok: false, error: msErr.message || "microsite upsert failed" };

  await admin.from("events").insert({
    type: "provider_published",
    provider_id: prov.id,
    ts: new Date().toISOString(),
    meta: { slug, source: "onboarding-action" },
  }).catch(() => {});

  return { ok: true, provider_id: prov.id, slug: prov.slug };
}
