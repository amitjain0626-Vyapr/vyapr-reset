// app/templates/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TemplatesPage(props: any) {
  const spRaw = props?.searchParams;
  const searchParams =
    spRaw && typeof spRaw.then === "function" ? await spRaw : spRaw || {};
  const slug = typeof searchParams?.slug === "string" ? searchParams.slug : "";

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">🧰 Template Packs</h1>
      <div className="rounded-xl border p-6 bg-gray-50 text-gray-700 text-sm">
        <p>
          Template packs are coming soon. You’ll find{" "}
          <strong>ready-to-send offers, reminder nudges, and posts</strong>{" "}
          here — personalized for your services.
        </p>
        <p className="mt-2">
          In the meantime, explore{" "}
          <a
            href={`/dashboard/leads?slug=${encodeURIComponent(slug)}`}
            className="text-indigo-600 underline"
          >
            your dashboard
          </a>{" "}
          to send reminders and reactivation nudges.
        </p>
      </div>
    </main>
  );
}
