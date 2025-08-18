// app/dashboard/payments/actions.ts
// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Create a payment from a <form action={createPayment}> server action.
 * Expected fields (adjust to your schema): amount, note?, status?
 */
export async function createPayment(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "Not authenticated" };

  const payload = {
    amount: Number(formData.get("amount") || 0),
    note: formData.get("note")?.toString() || null,
    status: (formData.get("status")?.toString() || "new").toLowerCase(),
    owner_id: auth.user.id, // RLS links to user
  };

  const { data, error } = await supabase
    .from("Payments")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/payments");
  return { ok: true, id: data.id };
}

/**
 * Delete a payment by id (optional helper if your UI uses it)
 */
export async function deletePayment(id: string) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("Payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/payments");
  return { ok: true };
}
