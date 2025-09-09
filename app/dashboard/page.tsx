// app/dashboard/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ReferralCard from "@/components/referral/ReferralCard";
import FunnelCard from "@/components/dashboard/FunnelCard";
import ShareRoiButton from "@/components/dashboard/ShareRoiButton";
import CampaignsTab from "@/components/dashboard/CampaignsTab";
import ReviewRequestCard from "@/components/reviews/ReviewRequestCard";
import ReplyTemplates from "@/components/reviews/ReplyTemplates";
import { BRAND, COPY } from "@/lib/brand";

type ROIConversion = {
  ok: boolean; leads?: number; bookings?: number; paid?: number;
  conv_lead_to_book_pct?: number; conv_book_to_paid_pct?: number; conv_lead_to_paid_pct?: number;
};
type ROIPending = { ok: boolean; currency?: string; pending_amount?: number; pending_count?: number };
type ROICollect = { ok: boolean; items?: Array<{ lead_id: string; amount_due: number; currency: string; pay_url: string; wa_url: string }>; };
type ROIBoost = { ok: boolean; suggestions?: Array<{ key: string; label: string; action_url: string; meta?: any }> };
type VerifyStatus = { ok: boolean; verified?: boolean; method?: string; referrals?: number };
type UpsellResp = { ok: boolean; slug: string; nudges: Array<{ key: string; label: string; kind: string; action_url: string; meta?: any }> };
type ROISummary = { ok: boolean; funnel?: { leads: number; bookings: number; revenue_inr: number } };

// Centralised base URL (no hard-coded vyapr domain)
const SITE = (process.env.NEXT_PUBLIC_BASE_URL || BRAND.baseUrl) as string;

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  let j: any = null; try { j = await r.json(); } catch {}
  return j as T;
}
function formatINR(n?: number) {
  if (!Number.isFinite(n as number)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n as number);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ slug?: string; tab?: string }> }) {
  const { slug, tab } = await searchParams;
  const useSlug = (slug || "").trim();
  const activeTab = (tab || "overview").toLowerCase();

  if (!useSlug) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600">Add <code>?slug=&lt;your-slug&gt;</code> to the URL to view ROI.</p>
        <p className="text-xs text-gray-500 mt-1">Example: {SITE}/dashboard?slug=amitjain0626</p>
      </main>
    );
  }

  const [pending, conv, collect, boost, verify, upsell, summary] = await Promise.all([
    getJSON<ROIPending>(`${SITE}/api/roi/pending?slug=${encodeURIComponent(useSlug)}`),
    getJSON<ROIConversion>(`${SITE}/api/roi/conversion?slug=${encodeURIComponent(useSlug)}`),
    getJSON<ROICollect>(`${SITE}/api/roi/cta/collect?slug=${encodeURIComponent(useSlug)}`),
    getJSON<ROIBoost>(`${SITE}/api/roi/cta/boost?slug=${encodeURIComponent(useSlug)}`),
    getJSON<VerifyStatus>(`${SITE}/api/verification/status?slug=${encodeURIComponent(useSlug)}`),
    getJSON<UpsellResp>(`${SITE}/api/upsell?slug=${encodeURIComponent(useSlug)}`),
    getJSON<ROISummary>(`${SITE}/api/roi/summary?slug=${encodeURIComponent(useSlug)}`),
  ]);

  const pendingAmount = pending?.pending_amount ?? 0;
  const pendingCount = pending?.pending_count ?? 0;

  const leads = conv?.leads ?? 0;
  const bookings = conv?.bookings ?? 0;
  const paid = conv?.paid ?? 0;

  // Guardrail: never-blank numbers for brand-new providers using ROI summary fallback
  const safeLeads = leads > 0 ? leads : Math.max(1, summary?.funnel?.leads ?? 0);
  const safeBookings = bookings > 0 ? bookings : Math.max(0, summary?.funnel?.bookings ?? 0);

  const pctLB = conv?.conv_lead_to_book_pct ?? 0;
  const pctBP = conv?.conv_book_to_paid_pct ?? 0;
  const pctLP = conv?.conv_lead_to_paid_pct ?? 0;

  const collectItems = collect?.items ?? [];
  const boostItems = boost?.suggestions ?? [];
  const isVerified = !!verify?.verified;

  const upsellNudges = (upsell?.nudges ?? []).slice(0, 4); // render up to 4 CTA buttons

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
              {COPY.verifiedBy}
            </span>
          ) : (
            <a
              href={`/settings/verification?slug=${encodeURIComponent(useSlug)}`}
              className="text-xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:shadow-sm"
              title="Improve trust with verification"
            >
              Get verified
            </a>
          )}
        </div>
        <div className="text-sm text-gray-500">Provider: <span className="font-mono">{useSlug}</span></div>
      </header>

      {/* Tabs */}
      <nav className="rounded-2xl border bg-white p-2">
        <ul className="flex flex-wrap gap-2">
          {[
            { key: "overview", label: "Overview" },
            { key: "campaigns", label: "Campaigns" },
            { key: "proof", label: "Proof" },
          ].map(t => (
            <li key={t.key}>
              <a
                href={`/dashboard?slug=${encodeURIComponent(useSlug)}&tab=${t.key}`}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm border ${activeTab===t.key ? "bg-black text-white border-black" : "bg-white hover:shadow-sm"}`}
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <>
          {/* KPI cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pending ₹ */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs text-gray-500">Pending</div>
              <div className="mt-1 text-2xl font-semibold">{formatINR(pendingAmount)}</div>
              <div className="text-xs text-gray-500 mt-1">{pendingCount} open {pendingCount === 1 ? "due" : "dues"}</div>
              <div className="mt-3">
                <a
                  href={`${SITE}/api/roi/cta/collect?slug=${encodeURIComponent(useSlug)}`}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs hover:shadow-sm"
                  target="_blank" rel="noopener"
                >
                  View pending list (JSON)
                </a>
              </div>
            </div>

            {/* Conversion quick view */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs text-gray-500">Conversion</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-semibold">{safeLeads}</div><div className="text-[11px] text-gray-500">Leads</div></div>
                <div><div className="text-lg font-semibold">{safeBookings}</div><div className="text-[11px] text-gray-500">Bookings</div></div>
                <div><div className="text-lg font-semibold">{paid}</div><div className="text-[11px] text-gray-500">Paid</div></div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="text-xs text-gray-700">{pctLB}% L→B</div>
                <div className="text-xs text-gray-700">{pctBP}% B→P</div>
                <div className="text-xs text-gray-700">{pctLP}% L→P</div>
              </div>
              <div className="mt-3">
                <a
                  href={`${SITE}/api/roi/conversion?slug=${encodeURIComponent(useSlug)}`}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs hover:shadow-sm"
                  target="_blank" rel="noopener"
                >
                  View conversion (JSON)
                </a>
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs text-gray-500">Quick Actions</div>
              <div className="mt-3 space-y-2">
                {/* Server-curated nudges (tracked via redirect) */}
                {upsellNudges.map(n => {
                  const to = n.action_url || "#";
                  const tracked = `/api/events/redirect?event=${encodeURIComponent("upsell.nudge.clicked")}&slug=${encodeURIComponent(useSlug)}&key=${encodeURIComponent(n.key)}&to=${encodeURIComponent(to)}`;
                  return (
                    <a
                      key={n.key}
                      href={tracked}
                      className="block text-center rounded-full border px-3 py-2 text-sm hover:shadow-sm"
                      title={n.label}
                    >
                      {n.label}
                    </a>
                  );
                })}

                {/* Fallbacks if upsell API returns nothing */}
                {upsellNudges.length === 0 && (
                  <>
                    <a
                      href={collectItems[0]?.wa_url || `${SITE}/api/roi/cta/collect?slug=${encodeURIComponent(useSlug)}`}
                      target="_blank" rel="noopener"
                      className="block text-center rounded-full border px-3 py-2 text-sm hover:shadow-sm"
                      title="Collect pending payments over WhatsApp"
                    >
                      Collect pending payments
                    </a>
                    {boostItems.map((s) => (
                      <a
                        key={s.key}
                        href={s.action_url.startsWith("/") ? s.action_url : `/${s.action_url}`}
                        className="block text-center rounded-full border px-3 py-2 text-sm hover:shadow-sm"
                      >
                        {s.label}
                      </a>
                    ))}
                  </>
                )}

                <ShareRoiButton slug={useSlug} />
              </div>
            </div>
          </section>

          {/* Deep Funnel */}
          <FunnelCard slug={useSlug} />

          {/* Referral */}
          <ReferralCard slug={useSlug} />

          {/* Helpful links */}
          <section className="rounded-2xl border bg-white p-5">
            <div className="text-xs text-gray-500 mb-3">Share</div>
            <div className="flex flex-wrap gap-3">
              <a href={`/book/${useSlug}`} className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm">Booking page</a>
              <a href={`/microsite/${useSlug}`} className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm">Microsite</a>
              <a href={`/vcard/${useSlug}`} className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm">Digital Card / QR</a>
              <a href={`/settings/verification?slug=${useSlug}`} className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm">Trust & Verification</a>
            </div>
          </section>
        </>
      )}

      {/* CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <CampaignsTab slug={useSlug} />
      )}

      {/* PROOF */}
      {activeTab === "proof" && (
        <>
          <section className="rounded-2xl border bg-white p-6 space-y-3">
            <div className="text-sm font-semibold">Share ROI Proof</div>
            <p className="text-sm text-gray-600">
              Create a WhatsApp-forwardable ROI summary for {useSlug}.
            </p>
            <div>
              <a
                href={`${SITE}/api/analytics/export?slug=${encodeURIComponent(useSlug)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center rounded-full border px-3 py-2 text-sm hover:shadow-sm"
              >
                View export (JSON)
              </a>
            </div>
            <div>
              <ShareRoiButton slug={useSlug} />
            </div>
          </section>

          {/* Reviews: request + reply (ORM Lite) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReviewRequestCard
              slug={useSlug}
              providerId={null}
              providerName={null}
              lang="en"
              tone="casual"
            />
            <ReplyTemplates
              slug={useSlug}
              providerId={null}
              providerName={null}
            />
          </section>
        </>
      )}
    </main>
  );
}
