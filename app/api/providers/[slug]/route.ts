// @ts-nocheck
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/site";

export async function GET(req, context) {
  const { slug } = await context.params; // params is a Promise in Next.js 15

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("Providers")
    .select(
      "id, display_name, slug, category, bio, phone, whatsapp, created_at, published"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data || !data.published) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const base = getBaseUrl();
  return NextResponse.json({
    ok: true,
    provider: {
      id: data.id,
      name: data.display_name,
      slug: data.slug,
      category: data.category,
      url: `${base}/book/${encodeURIComponent(data.slug)}`,
      bio: data.bio,
      phone: data.phone,
      whatsapp: data.whatsapp,
      created_at: data.created_at,
    },
  });
}
