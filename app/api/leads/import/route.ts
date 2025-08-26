// app/api/leads/import/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

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
        // peek next
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
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
        continue;
      }
      if (ch === "\r") {
        // normalize CRLF or CR
        i++;
        continue;
      }
      if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
        continue;
      }
      cell += ch;
      i++;
    }
  }
  // last cell
  row.push(cell);
  // last row if not empty (or if single empty line)
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) {
    rows.push(row);
  }
  // trim trailing blank rows
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) {
    rows.pop();
  }
  return rows;
}

/* ---------- Handler ---------- */
export async function POST(req: Request) {
  try {
    // Expect multipart/form-data with fields:
    // - slug: provider slug (required)
    // - file: CSV file (required) with headers: patient_name, phone, (optional) note
    const form = await req.formData();
    const slug = (form.get("slug") || "").toString().trim();
    const file = form.get("file") as File | null;

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ ok: false, error: "missing_csv_file" }, { status: 400 });
    }

    const sb = admin();

    // Resolve provider
    const { data: prov, error: pErr } = await sb
      .from("Providers")
      .select("id, slug, display_name, published")
      .eq("slug", slug)
      .single();

    if (pErr || !prov?.id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    // Read CSV text
    const csvText = await file.text();
    const grid = parseCSV(csvText);
    if (!grid.length) {
      return NextResponse.json({ ok: false, error: "empty_csv" }, { status: 400 });
    }

    // Headers
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const colIdx = {
      patient_name: header.indexOf("patient_name"),
      phone: header.indexOf("phone"),
      note: header.indexOf("note"),
    };
    if (colIdx.patient_name === -1 || colIdx.phone === -1) {
      return NextResponse.json(
        { ok: false, error: "missing_required_headers", required: ["patient_name", "phone"], header },
        { status: 400 }
      );
    }

    // Build rows
    const rows: LeadRow[] = [];
    let skipped = 0;
    for (let r = 1; r < grid.length; r++) {
      const line = grid[r];
      const name = (line[colIdx.patient_name] || "").toString().trim();
      const phone = sanitizePhone(line[colIdx.phone] || "");
      const note = colIdx.note >= 0 ? (line[colIdx.note] || "").toString() : null;
      if (!phone) {
        skipped++;
        continue;
      }
      rows.push({
        provider_id: prov.id,
        patient_name: name,
        phone,
        note,
        status: "new",
        source: { utm: { source: "import:csv" } },
      });
    }

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "no_valid_rows", skipped }, { status: 400 });
    }

    // Insert in one batch (service role bypasses RLS)
    const { data: inserted, error: insErr } = await sb.from("Leads").insert(rows).select("id");
    if (insErr) {
      return NextResponse.json({ ok: false, error: "lead_batch_insert_failed", detail: insErr.message }, { status: 500 });
    }

    const count = inserted?.length || rows.length;

    // Telemetry (match your existing table casing & ts style)
    const eventRow = {
      event: "lead.imported",
      ts: Date.now(), // your existing events use numeric ms
      provider_id: prov.id,
      lead_id: null,
      count,
      source: { method: "import:csv" },
    };
    const { error: eErr } = await sb.from("Events").insert(eventRow);
    if (eErr) {
      // Do not fail the API if telemetry write fails — just log
      console.error("Events insert failed (lead.imported)", eErr);
    }

    return NextResponse.json({
      ok: true,
      provider_slug: prov.slug,
      imported: count,
      skipped,
    });
  } catch (e: any) {
    console.error("leads/import exception", e);
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}

// Optional healthcheck
export async function GET() {
  return NextResponse.json({ ok: true });
}
