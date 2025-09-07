// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function providerBySlug(slug: string) {
  const sb = admin();
  const { data, error } = await sb.from("Providers").select("id, slug").eq("slug", slug).maybeSingle();
  if (error || !data?.id) throw new Error("provider_not_found");
  return data as { id: string; slug: string };
}

async function readBody(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: any = {};
    for (const [k, v] of fd.entries()) obj[k] = String(v);
    return obj;
  }
  return {};
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const slug = String(body.slug || "").trim();
    const doc_type = String(body.doc_type || "").trim().toLowerCase();
    const doc_ref = body.doc_ref ? String(body.doc_ref).trim() : null;
    const note = body.note ? String(body.note).trim() : null;

    if (!slug || !doc_type) {
      return NextResponse.json({ ok: false, error: "missing_slug_or_doc_type" }, { status: 400 });
    }

    const provider = await providerBySlug(slug);
    const sb = admin();
    const ts = Date.now();

    const source: any = { doc_type };
    if (doc_ref) source.doc_ref = doc_ref;
    if (note) source.note = note;

    const { error } = await sb.from("Events").insert({
      event: "verification.doc.submitted",
      ts,
      provider_id: provider.id,
      lead_id: null,
      source,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, provider_id: provider.id, status: "pending_review", method: "doc_or_admin" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
