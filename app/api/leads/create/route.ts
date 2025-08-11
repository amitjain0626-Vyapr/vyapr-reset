// app/api/leads/create/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, patient_name, phone, note, utm } = body || {};

    if (!slug || !patient_name || !phone) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Resolve dentist by slug (must be published)
    const { data: dentist, error: dErr } = await supabase
      .from("Dentists")
      .select("id, slug, is_published")
      .eq("slug", String(slug))
      .eq("is_published", true)
      .maybeSingle();

    if (dErr) {
      return NextResponse.json(
        { ok: false, error: "Lookup failed", details: dErr.message },
        { status: 500 }
      );
    }
    if (!dentist) {
      return NextResponse.json(
        { ok: false, error: "Microsite not found or unpublished" },
        { status: 404 }
      );
    }

    // Insert lead (RLS allows public insert)
    const payload = {
      dentist_id: dentist.id,
      source_slug: String(slug),
      patient_name: String(patient_name),
      phone: String(phone),
      note: note ? String(note) : null,
      utm: typeof utm === "object" && utm !== null ? utm : {},
    };

    const { data, error } = await supabase
      .from("Leads")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Insert failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id || null }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Unhandled error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
