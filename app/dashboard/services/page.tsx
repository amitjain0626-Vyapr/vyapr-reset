// app/dashboard/services/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();

  // Auth
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect("/login");

  // Load services owned by this user
  const { data: services } = await supabase
    .from("Services")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your Services</h1>
        <a
          href="/dashboard/services/add"
          className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm hover:shadow-sm"
        >
          ➕ Add service
        </a>
      </div>

      {!services?.length && (
        <div className="rounded-xl border p-4 bg-gray-50 text-sm text-gray-600">
          No services added yet. Add your offerings to help customers pick faster.
        </div>
      )}

      {!!services?.length && (
        <>
          <h2 className="text-lg font-medium">Existing Services</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s: any) => (
              <div key={s.id} className="border rounded-2xl p-4 bg-white">
                <div className="text-sm font-semibold">{s.title || s.name || "Service"}</div>
                {s.description ? (
                  <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{s.description}</p>
                ) : null}
                <div className="mt-2 text-xs text-gray-500">
                  {Number.isFinite(Number(s.price)) ? `₹${Math.round(Number(s.price))}` : ""}
                  {s.duration ? ` · ${s.duration} min` : ""}
                  {s.mode ? ` · ${s.mode}` : ""}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a href={`/dashboard/services/edit?id=${encodeURIComponent(s.id)}`} className="text-sm underline">
                    Edit
                  </a>
                  <a href={`/book/${encodeURIComponent(s.provider_slug || "")}`} className="text-sm underline">
                    View on booking page
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
