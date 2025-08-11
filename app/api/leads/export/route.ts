import { NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase/server";

function toCSV(rows: any[]) {
  if (!rows.length) return "id,name,phone,source,note,created_at\\n";
  const header = ["id","name","phone","source","note","created_at"];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, """""");
    return /[",\\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = rows.map(r => header.map(h => esc(r[h])).join(","));
  return header.join(",") + "\\n" + lines.join("\\n") + "\\n";
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

  const csv = toCSV((data ?? []).map(r => ({
    id: r.id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    source: r.source ?? "",
    note: r.note ?? "",
    created_at: r.created_at ?? "",
  })) as any[]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-export.csv"`, 
      "cache-control": "no-store",
    },
  });
}
