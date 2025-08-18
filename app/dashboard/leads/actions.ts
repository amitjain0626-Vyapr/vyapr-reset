// app/dashboard/leads/actions.ts
// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Create a lead from a <form action={createLead}> server action.
 * Expects fields: patient_name, phone, status?, source?, note?
 */
export async function createLead(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const payload = {
    patient_name: formData.get("patient_name")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    status: (formData.get("status")?.toString() || "new").toLowerCase(),
    source: formData.get("source")?.toString() || "microsite",
    note: formData.get("note")?.toString() || null,
    owner_id: auth.user.id,
  };

  const { data, error } = await supabase.from("Leads").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };

  // Make sure the dashboard reloads with fresh data
  revalidatePath("/dashboard/leads");
  return { ok: true, id: data.id };
}

/**
 * Delete a lead by id. Used by dashboard tables.
 */
export async function deleteLead(id: string) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("Leads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

/**
 * Update lead status (optional helper if UI calls it directly as a server action)
 */
export async function updateLeadStatus(id: string, status: string) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("Leads").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

/**
 * Update lead note (optional helper if UI uses server actions instead of API)
 */
export async function updateLeadNote(id: string, note: string) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("Leads").update({ note }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/leads");
  return { ok: true };
}
