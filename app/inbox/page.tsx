// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { addTestLead, markContacted } from "./actions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qp = await searchParams;                 // Next 15: await
  const slug = typeof qp?.slug === "string" ? qp.slug : "";

  if (!slug) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Lead Inbox</h1>
        <p className="text-sm text-gray-600">
          Open: <code>/inbox?slug=amit</code>
        </p>
      </div>
    );
  }

  // Provider
  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!provider) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Lead Inbox</h1>
        <p className="text-sm text-red-600">Provider not found for slug: {slug}</p>
      </div>
    );
  }

  // Recent leads
  const { data: leads } = await supabase
    .from("events")
    .select("id, ts, person_id, meta")
    .eq("provider_id", provider.id)
    .eq("type", "lead")
    .order("ts", { ascending: false })
    .limit(50);

  const personIds = Array.from(new Set((leads || []).map(l => l.person_id).filter(Boolean)));
  let personsById: Record<string, any> = {};
  if (personIds.length) {
    const { data: persons } = await supabase
      .from("persons")
      .select("id, name, phone, email")
      .in("id", personIds);
    for (const p of persons || []) personsById[p.id] = p;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Lead Inbox</h1>
        <p className="text-sm text-gray-600">
          Provider: {provider.name} · slug: {provider.slug}
        </p>

        {/* Add test lead button */}
        <form
          action={async () => {
            "use server";
            await addTestLead(slug);
            return null;
          }}
        >
          <button className="px-3 py-1 rounded bg-teal-600 text-white text-sm">
            + Add test lead
          </button>
        </form>
      </header>

      <div className="border rounded divide-y">
        {(leads || []).length === 0 && (
          <div className="p-4 text-sm text-gray-500">No leads yet.</div>
        )}

        {(leads || []).map((l) => {
          const person = personsById[l.person_id] || {};
          const when = new Date(l.ts).toLocaleString();
          const preferred = l?.meta?.when ? String(l.meta.when) : "";
          const note = l?.meta?.note ? String(l.meta.note) : "";
          const wa = person?.phone
            ? `https://wa.me/${String(person.phone).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Hi ${person?.name || ""}, thanks for reaching out to ${provider.name}.`
              )}`
            : null;

          return (
            <div
              key={l.id}
              className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium">
                  {person?.name || "Unknown"} · {person?.phone || ""}
                </div>
                <div className="text-xs text-gray-500">
                  Lead at {when}
                  {preferred ? ` · Pref: ${preferred}` : ""}
                  {note ? ` · Note: ${note}` : ""}
                </div>
              </div>

              <div className="flex gap-2">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    className="px-3 py-1 rounded bg-green-600 text-white text-sm"
                  >
                    WhatsApp
                  </a>
                )}

                <form
                  action={async () => {
                    "use server";
                    await markContacted(slug, l.person_id);
                    return null;
                  }}
                >
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-teal-600 text-white text-sm"
                  >
                    Mark contacted
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500">
        Tip: click “+ Add test lead” to simulate a new incoming lead instantly.
      </div>
    </div>
  );
}
