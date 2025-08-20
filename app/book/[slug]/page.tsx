// @ts-nocheck
export const dynamic = "force-dynamic";

export default function Page({ params }: any) {
  const slug = params?.slug ?? "(no-slug)";
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* marker so we can grep */}
      <div className="text-[10px] uppercase tracking-widest text-gray-500">VYAPR-9.5 UI</div>

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{slug}</h1>
        <div className="text-sm text-gray-600">
          <a href="/directory" className="underline">← Back to directory</a>
        </div>
      </header>

      {/* Quick facts (static placeholders for now) */}
      <section className="grid grid-cols-1 gap-3 text-sm">
        <div><span className="font-medium">Price range:</span> —</div>
        <div className="space-y-0.5">
          <div className="font-medium">Address</div>
          <div>—</div>
        </div>
        <div><span className="font-medium">Geo:</span> —</div>
      </section>

      {/* Opening hours (static section title for grep) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <div className="rounded-lg border p-3 text-sm text-gray-500">Hours not available.</div>
      </section>

      {/* FAQs (static section title for grep) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">FAQs</h2>
        <p className="text-sm text-gray-600">No FAQs yet.</p>
      </section>
    </div>
  );
}
