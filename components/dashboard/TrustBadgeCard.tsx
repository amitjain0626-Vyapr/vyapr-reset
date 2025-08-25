// @ts-nocheck
import { createSupabaseServerClient } from "../../lib/supabase/server";
import TrustDocUploader from "./TrustDocUploader";

function StatusPill({ status, verified }: { status: string; verified: boolean }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const key = verified ? "approved" : (status || "pending");
  const cls = map[key] || map.pending;
  const label = verified ? "Verified" : (status || "Pending").replace(/^\w/, (c) => c.toUpperCase());
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>{label}</span>;
}

export default async function TrustBadgeCard() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 🔒 Do NOT select specific columns (prod may not have them yet) — select * and read defensively
    const { data: provider, error } = await supabase
      .from("Providers")
      .select("*")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      // If Providers table/row missing in prod, fail silently (no crash)
      return null;
    }

    const displayName = provider?.display_name || "Your profile";
    const verified = !!(provider && "verified" in provider && provider.verified);
    const status = (provider && "verification_status" in provider && provider.verification_status) || "pending";
    const docPath = (provider && "verification_doc_path" in provider && provider.verification_doc_path) || null;

    return (
      <div className="rounded-2xl border border-gray-200 p-4 mb-4 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-700">Trust badge</div>
            <div className="text-base font-semibold">
              {displayName} <StatusPill status={status} verified={verified} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Upload any govt/association ID or GST doc. We’ll review and mark your profile verified.
            </div>
          </div>
          <TrustDocUploader onDone={() => { /* page refresh by user nav; MVP */ }} />
        </div>

        {docPath && !verified && (
          <div className="text-xs text-gray-600 mt-2">
            Doc received: <code>{docPath}</code>. Status: {status}.
          </div>
        )}
      </div>
    );
  } catch {
    // Never crash the page in prod
    return null;
  }
}
