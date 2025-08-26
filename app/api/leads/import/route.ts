// app/api/leads/import/route.ts
// @ts-nocheck
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

/* ---------- tiny helpers ---------- */
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* ---------- Supabase (service role) ---------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- Utils ---------- */
function sanitizePhone(s: string) {
  return (s || "").toString().replace(/[^\d+]/g, ""); // keep leading + and digits
}

type LeadRow = {
  provider_id: string;
  patient_name: string;
  phone: string;
  note?: string | null;
  status: "new";
  source: any;
};

/**
 * Minimal CSV parser that handles:
 * - Header row (required headers: patient_name, phone; optional: note)
 * - Quoted fields with commas and newlines
 * - UTF-8 input
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"'; // escaped quote
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        cell += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
      if (ch === "\r") { i++; continue; } // normalize CRLF
      if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
      cell += ch; i++;
    }
  }
  row.push(cell);
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

/* ---------- Handlers ---------- */
export async function POST(req: Request) {
  try {
    // Expect multipart/form-data:
    // - slug: provider slug (required)
    // - file: CSV (required) with headers: patient_name, phone, (optional) note
    const form = await req.formData();
    const slug = (form.get("slug") || "").toString().trim();
    const file = form.get("file") as File | null;

    if (!slug) return json({ ok: false, error: "missing_slug" }, 400);
    if (!file) return json({ ok: false, error: "missing_csv_file" }, 400);

    const sb = admin();

    // Resolve provider
    const { data: prov, error: pErr } = await sb
      .from("Providers")
      .select("id, slug, display_name, published")
      .eq("slug", slug)
      .single();

    if (pErr || !prov?.id) return json({ ok: false, error: "provider_not_found" }, 404);

    // Read & parse CSV
    const csvText = await file.text();
    const grid = parseCSV(csvText);
    if (!grid.length) return json({ ok: false, error: "empty_csv" }, 400);

    // Headers
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const colIdx = {
      patient_name: header.indexOf("patient_name"),
      phone: header.indexOf("phone"),
      note: header.indexOf("note"),
    };
    if (colIdx.patient_name === -1 || colIdx.phone === -1) {
      return json(
        { ok: false, error: "missing_required_headers", required: ["patient_name", "phone"], header },
        400
      );
    }

    // Build lead rows
    const rows: LeadRow[] = [];
    let skipped = 0;
    for (let r = 1; r < grid.length; r++) {
      const line = grid[r];
      const name = (line[colIdx.patient_name] || "").toString().trim();
      const phone = sanitizePhone(line[colIdx.phone] || "");
      const note = colIdx.note >= 0 ? (line[colIdx.note] || "").toString() : null;
      if (!phone) { skipped++; continue; }
      rows.push({
        provider_id: prov.id,
        patient_name: name,
        phone,
        note,
        status: "new",
        source: { utm: { source: "import:csv" } },
      });
    }

    if (!rows.length) return json({ ok: false, error: "no_valid_rows", skipped }, 400);

    // Batch insert Leads
    const { data: inserted, error: insErr } = await sb.from("Leads").insert(rows).select("id");
    if (insErr) return json({ ok: false, error: "lead_batch_insert_failed", detail: insErr.message }, 500);

    const count = inserted?.length || rows.length;

    // --- Telemetry: write to Events (match existing schema) ---
    // Your Events rows show: event (text), ts (number ms), provider_id, lead_id, source (jsonb).
    // We do NOT include 'count' to avoid column mismatch.
    const eventRow = {
      event: "lead.imported",
      ts: Date.now(),               // numeric ms like your current rows
      provider_id: prov.id,
      lead_id: null,
      source: { method: "import:csv" },
    };

    // Use "Events" (capital E) to match your existing table casing
    const { error: e1 } = await sb.from("Events").insert(eventRow);
    if (e1) {
      // soft-fail telemetry; import has already succeeded
      console.error("[telemetry] Events insert failed (lead.imported):", e1.message || e1);
    }
    // --- end telemetry ---

    return json({ ok: true, provider_slug: prov.slug, imported: count, skipped });
  } catch (e: any) {
    console.error("leads/import exception", e);
    return json({ ok: false, error: "bad_request" }, 400);
  }
}

// healthcheck
export async function GET() {
  return json({ ok: true });
}
