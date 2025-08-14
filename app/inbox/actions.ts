// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// anon client (for reads)
const supaAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// admin client (to bypass RLS for updates/seeding during beta)
const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function addTestLead(slug: string) {
  if (!slug) return { ok: false, error: "missing_slug" };

  const { data: prov } = await supaAnon
    .from("providers")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();
  if (!prov) return { ok: false, error: "provider_not_found" };

  // upsert a random test person
  const phone = "99900" + Math.floor(100000 + Math.random() * 899999).toString();
  const name = "Test Lead " + phone.slice(-4);

  const { data: person, error: pErr } = await supaAdmin
    .from("persons")
    .upsert({ phone, name }, { onConflict: "phone", ignoreDuplicates: false })
    .select("id, name, phone")
    .single();
  if (pErr || !person) return { ok: false, error: "person_upsert_failed" };

  // create relationship (ignore if already exists)
  await supaAdmin.from("relationships").insert({
    person_id: person.id,
    provider_id: prov.id,
    status: "lead",
    visit_count: 0,
  });

  // add a lead event
  await supaAdmin.from("events").insert({
    person_id: person.id,
    provider_id: prov.id,
    type: "lead",
    meta: { when: "Tomorrow 5pm", note: "Test lead via inbox button", source: "inbox_test" },
  });

  revalidatePath("/inbox");
  return { ok: true };
}

export async function markContacted(slug: string, personId: string) {
  if (!slug || !personId) return { ok: false, error: "missing_fields" };

  const { data: prov } = await supaAnon
    .from("providers")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!prov) return { ok: false, error: "provider_not_found" };

  const { error: relErr } = await supaAdmin
    .from("relationships")
    .update({ status: "active", last_seen: new Date().toISOString() })
    .eq("person_id", personId)
    .eq("provider_id", prov.id);
  if (relErr) return { ok: false, error: relErr.message };

  await supaAdmin.from("events").insert({
    person_id: personId,
    provider_id: prov.id,
    type: "message",
    meta: { action: "contacted", via: "inbox" },
  });

  revalidatePath("/inbox");
  return { ok: true };
}
