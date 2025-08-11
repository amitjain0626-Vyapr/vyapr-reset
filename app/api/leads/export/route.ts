import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase/server";

function toCSV(rows: any[]) {
  const header = ["id","name","phone","source","note","created_at"];
  if (!rows?.length) return header.join(",") + "\n";

  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""'); // correct CSV escaping
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const lines = rows.map(r => header.map(h => esc((r as any)[h])).join(","));
  return header.join(",") + "\n" + lines.join("\n") + "\n";
}

export async function GET() {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("Leads")
    .select("id,name,phone,source,note,created_at,deleted_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return new NextResponse("Error: " + error.message, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    source: r.source ?? "",
    note: r.note ?? "",
    created_at: r.created_at ?? "",
  }));

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-export.csv"`,
      "cache-control": "no-store",
    },
  });
}
