// @ts-nocheck
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function bookRequestAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const when = String(formData.get("when") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!slug || !name || !phone) {
    return redirect(`/book/${slug}?error=missing`);
  }

  // 1) Provider
  const { data: provider, error: provErr } = await supabase
    .from("providers")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (provErr || !provider) return redirect(`/book/${slug}?error=no_provider`);

  // 2) Upsert Person
  const { data: personRow, error: personErr } = await supabase
    .from("persons")
    .upsert({ phone, name }, { onConflict: "phone", ignoreDuplicates: false })
    .select("id")
    .single();
  if (personErr || !personRow) return redirect(`/book/${slug}?error=person`);

  // 3) Relationship (best‑effort)
  await supabase.from("relationships").insert({
    person_id: personRow.id,
    provider_id: provider.id,
    status: "lead",
    visit_count: 0,
  });

  // 4) Event: lead
  await supabase.from("events").insert({
    person_id: personRow.id,
    provider_id: provider.id,
    type: "lead",
    meta: { when, note, source: "microsite" },
  });

  // 5) Calendar stub (non‑blocking)
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/google-calendar/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: provider.id,
        bookingDetails: { name, phone, when, note },
      }),
    });
  } catch {}

  return redirect(`/book/${slug}?ok=1`);
}
