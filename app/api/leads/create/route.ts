// @ts-nocheck
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function jerr(status: number, code: string, message: string, meta: any = {}) {
  const metaOut: any = { ...meta };
  const err = meta?.error;
  if (err) {
    metaOut.code = err.code || err.name;
    metaOut.details = err.details || err.message || String(err);
    metaOut.hint = err.hint ?? undefined;
  }
  return json({ ok: false, error: { code, message }, meta: metaOut }, status);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Required minimal lead data
    for (const k of ["slug", "patient_name", "phone"] as const) {
      if (!body?.[k] || String(body[k]).trim() === "") {
        return jerr(400, "VALIDATION_FAILED", `Missing field: ${k}`);
      }
    }

    const supabase = getSupabaseServer();

    // 1) Provider lookup by slug
    const { data: provider, error: provErr } = await supabase
      .from("providers")
      .select("id, owner_id, slug")
      .eq("slug", body.slug)
      .single();
    if (provErr || !provider) {
      return jerr(404, "NO_PROVIDER", "Provider not found.", { provErr });
    }

    // 2) Insert lead
    const { error: leadErr } = await supabase.from("leads").insert({
      provider_id: provider.id,
      name: body.patient_name,
      phone: body.phone,
      note: body.note || null,
      utm: body.utm || null,
    });
    if (leadErr) return jerr(500, "LEAD_INSERT_FAILED", "Could not save lead.", { leadErr });

    // 3) ✅ Telemetry (best-effort; don't block main flow)
    try {
      await supabase.from("events").insert({
        provider_id: provider.id,
        type: "lead_created",
        meta: {
          slug: provider.slug,
          patient_name: body.patient_name,
          phone: body.phone,
          utm: body.utm || null,
        },
      });
    } catch (telemetryErr) {
      console.log("[lead:create] telemetry insert failed", telemetryErr);
    }

    return json({ ok: true });
  } catch (e: any) {
    return jerr(500, "UNHANDLED", "Unexpected server error.", { message: e?.message });
  }
}
