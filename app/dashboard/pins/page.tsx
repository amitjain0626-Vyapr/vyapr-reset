// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getPins(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/templates/pinned?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!res.ok) return { items: [] };
  return res.json();
}

export default async function PinsPage({ searchParams }: any) {
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";
  const data = await getPins(slug);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">⭐ Pinned Templates</h1>
      <div className="text-sm text-gray-600">Provider: {slug || "—"}</div>

      {(!data?.items || data.items.length === 0) ? (
        <div className="rounded-xl border p-4 bg-gray-50 text-gray-700 text-sm">
          No pinned templates yet. Go to <a className="underline text-indigo-600" href={`/templates?slug=${encodeURIComponent(slug)}`}>Templates</a> and click ☆ Pin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.map((it: any) => (
            <div key={it.template_id} className="rounded-2xl border p-4 bg-white space-y-2 shadow-sm">
              <div className="text-xs text-gray-500 uppercase tracking-wider">{it.category}</div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-xs text-gray-600">ID: {it.template_id}</div>
              <a
                className="inline-block mt-2 text-sm px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50"
                href={`/templates?slug=${encodeURIComponent(slug)}`}
              >
                Go to Templates
              </a>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
