// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    // multipart/form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "file_missing" }, { status: 400 });
    }

    // path: trust/<user.id>/<timestamp>_<filename>
    const ts = Date.now();
    const safeName = (file.name || "doc.pdf").replace(/[^\w.\-]+/g, "_");
    const path = `trust/${user.id}/${ts}_${safeName}`;

    // Upload to private bucket
    const { error: upErr } = await supabase.storage.from("trust-docs").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) {
      console.error("upload error", upErr);
      return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
    }

    // Update provider row: mark "pending" (manual approval later)
    const { error: updErr } = await supabase
      .from("Providers")
      .update({
        verification_doc_path: path,
        verification_status: "pending",
        // keep verified=false unless an admin approves; for MVP we show "Pending"
      })
      // Owner-scoped via RLS; update by owner_id
      .eq("owner_id", user.id);

    if (updErr) {
      console.error("provider update error", updErr);
      return NextResponse.json({ ok: false, error: "provider_update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path, status: "pending" });
  } catch (e) {
    console.error("unexpected", e);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
