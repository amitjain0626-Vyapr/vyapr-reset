// @ts-nocheck
"use server";

import { createClient } from "@supabase/supabase-js";

export async function togglePublish(slug: string, publish: boolean) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-side
    { auth: { persistSession: false } }
  );

  const { error } = await supabase
    .from("providers")
    .update({ published: publish })
    .eq("slug", slug);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
