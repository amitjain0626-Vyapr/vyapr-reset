// @ts-nocheck
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lead_id = searchParams.get("lead_id");
    if (!lead_id) {
      return new NextResponse("Missing lead_id", { status: 400 });
    }

    const supabase = getAdmin();
    const { data, error } = await supabase
      .from("Events")
      .select("*")
      .eq("lead_id", lead_id)
      .order("ts", { ascending: false });

    if (error) {
      return new NextResponse("Error fetching events: " + error.message, {
        status: 500,
      });
    }

    // Build CSV
    const header = ["id", "event", "ts", "provider_id", "lead_id", "source"];
    const rows = data.map((ev: any) => [
      ev.id,
      ev.event,
      ev.ts,
      ev.provider_id,
      ev.lead_id,
      JSON.stringify(ev.source),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="timeline-${lead_id}.csv"`,
      },
    });
  } catch (e: any) {
    return new NextResponse("Error: " + (e?.message || "Unknown"), {
      status: 500,
    });
  }
}
