// app/api/leads/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing provider slug" },
        { status: 400 }
      );
    }

    // 🔑 Get provider ID from slug
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("slug", slug)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { ok: false, error: "Provider not found" },
        { status: 404 }
      );
    }

    // ✅ Fetch leads linked to this provider
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("dentist_id", provider.id) // 👈 points to providers.id
      .order("created_at", { ascending: false });

    if (leadsError) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch leads", details: leadsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, leads }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
