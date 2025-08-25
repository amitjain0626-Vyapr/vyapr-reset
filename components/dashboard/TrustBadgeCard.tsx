// @ts-nocheck
import { createSupabaseServerClient } from "../../lib/supabase/server";
import TrustDocUploader from "./TrustDocUploader";

function StatusPill({ status, verified }: { status: string; verified: boolean }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = map[verified ? "approved" : status] || map["pending"];
  const label = verified ? "Verified" : (status || "Pending").replace(/^\w/, (c) => c.toUpperCase());
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls}`}>{label}</span>;
}

export default async function TrustBadgeCard() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch current provider row for this owner
  const { data: provider } = await supabase
    .from("Providers")
    .select("display_name, verification_status, verified, verification_doc_path")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  const status = provider?.verification_status || "pending";
  const verified = !!provider?.verified;

  // On upload, we’ll refresh the server component by navigating (handled by parent page refresh)
  async function RefreshHint() {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4 mb-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-gray-700">Trust badge</div>
          <div className="text-base font-semibold">
            {provider?.display_name || "Your profile"}{" "}
            <StatusPill status={status} verified={verified} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Upload any government/association ID or GST doc. We’ll review and mark your profile verified.
          </div>
        </div>
        <TrustDocUploader onDone={() => { /* page refresh happens by user nav; minimal MVP */ }} />
      </div>

      {provider?.verification_doc_path && !verified && (
        <div className="text-xs text-gray-600 mt-2">
          Doc received: <code>{provider.verification_doc_path}</code>. Status: {status}.
        </div>
      )}
    </div>
  );
}
