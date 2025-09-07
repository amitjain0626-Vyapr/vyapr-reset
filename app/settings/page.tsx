// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Settings (slug-first, crash-proof)
 * - Works with ?slug=<provider-slug>
 * - No auth required
 * - Never throws if rows are missing
 * - No tricky JSX in code blocks
 */

type SP = { slug?: string };

async function safeGetUserAndProviderSlug(): Promise<string | null> {
  try {
    const mod = await import("@/utils/supabase/server").catch(() => null as any);
    if (!mod?.createClient) return null;

    const supabase = await mod.createClient();
    const { data: { user } = { user: null } } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("Providers")
      .select("slug")
      .eq("user_id", user.id)
      .limit(1);

    if (error || !data?.length) return null;
    return data[0]?.slug || null;
  } catch {
    return null;
  }
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { slug } = await searchParams;
  let providerSlug = (slug || "").trim();
  if (!providerSlug) {
    const fromUser = await safeGetUserAndProviderSlug();
    providerSlug = fromUser || "";
  }

  const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
  const micrositeUrl = providerSlug ? `/microsite/${providerSlug}` : "";
  const bookingUrl = providerSlug ? `/book/${providerSlug}` : "";
  const vcardUrl = providerSlug ? `/vcard/${providerSlug}` : "";
  const verifyUrl = providerSlug ? `/settings/verification?slug=${providerSlug}` : "";

  return (
    <main className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          {providerSlug ? (
            <>Provider: <span className="font-mono">{providerSlug}</span></>
          ) : (
            <>Tip: open <span className="font-mono">/settings?slug=&lt;your-slug&gt;</span> from the dashboard.</>
          )}
        </p>
      </header>

      {/* Microsite & sharing quick links */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="text-sm text-gray-500 mb-2">Microsite</div>
        <div className="text-blue-700 font-medium">{providerSlug || "—"}</div>

        <div className="mt-3 flex flex-wrap gap-3">
          <a className="underline text-sm" href={micrositeUrl || "#"} target="_blank" rel="noreferrer"
             aria-disabled={!micrositeUrl}>{micrositeUrl ? "Preview microsite" : "Add ?slug= to URL"}</a>
          <a className="underline text-sm" href={bookingUrl || "#"} target="_blank" rel="noreferrer"
             aria-disabled={!bookingUrl}>{bookingUrl ? "Open booking page" : "—"}</a>
          <a className="underline text-sm" href={vcardUrl || "#"} target="_blank" rel="noreferrer"
             aria-disabled={!vcardUrl}>{vcardUrl ? "Digital card / QR" : "—"}</a>
          <a className="underline text-sm" href={verifyUrl || "#"}>
            Trust & Verification
          </a>
        </div>
      </section>

      {/* Services & Pricing — placeholder for MVP */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Services & pricing</h2>
        <p className="text-sm text-gray-600 mt-1">
          For MVP, add or update your services from onboarding/data import. This section is read-only for now.
        </p>
        <div className="mt-3 rounded-lg border p-3 bg-gray-50 text-xs text-gray-600">
          Coming soon: inline editor (name, price, description) with “Save” & “Publish”.
        </div>
      </section>

      {/* Help */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold">Need help?</h3>
        <p className="text-xs text-gray-600 mt-1">
          If you don’t see your slug here, open this page via the Dashboard CTA (it auto-includes your slug).
        </p>
      </section>
    </main>
  );
}
