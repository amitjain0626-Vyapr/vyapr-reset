// components/leads/UnverifiedImports.tsx
// @ts-nocheck

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  status?: string | null;
  source?: any;
  created_at?: string | null;
  note?: string | null;
};

export default function UnverifiedImports({
  leads = [],
  onVerify,
  onDiscard,
}: {
  leads: Lead[];
  onVerify: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  /* === INSERT START (22.16: built-in verify/merge/discard wiring) === */
  function getSlugFromURL(): string {
    try {
      const sp = new URLSearchParams(window.location.search || "");
      return (sp.get("slug") || "").trim();
    } catch {
      return "";
    }
  }

  async function postVerify(payload: { action: "confirm" | "reject" | "discard"; a_id: string; b_id?: string }) {
    const slug = getSlugFromURL();
    if (!slug) return { ok: false, error: "missing_slug" };
    const res = await fetch(`/api/contacts/verify?slug=${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    try {
      return await res.json();
    } catch {
      return { ok: false, error: "invalid_json" };
    }
  }

  async function confirmLocal(id: string) {
    if (typeof onVerify === "function") return onVerify(id);
    await postVerify({ action: "confirm", a_id: id });
  }

  async function discardLocal(id: string) {
    if (typeof onDiscard === "function") return onDiscard(id);
    await postVerify({ action: "discard", a_id: id });
  }

  async function mergeLocal(a_id: string) {
    const b_id = window.prompt("Merge into existing lead ID (b_id):");
    if (!b_id) return;
    await postVerify({ action: "reject", a_id, b_id });
  }
  /* === INSERT END === */

  if (!Array.isArray(leads) || leads.length === 0) {
    return (
      <div className="rounded border border-gray-200 p-3 text-sm text-gray-500" data-test="unverified-empty">
        No unverified leads right now.
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3" data-test="unverified-box">
      <div className="mb-2 text-sm font-medium text-amber-900">
        Imported (needs verification)
      </div>
      <ul className="space-y-2">
        {leads.map((l) => (
          <li
            key={l.id}
            className="flex items-center justify-between rounded border border-amber-200 bg-white p-2"
            data-test="unverified-item"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {l.patient_name || l.phone || "Lead"}
              </div>
              <div className="truncate text-xs text-gray-500">
                {l.phone || ""} {l.note ? `· ${l.note}` : ""}
              </div>
            </div>
            <div className="shrink-0 space-x-2">
              <button
                type="button"
                onClick={() => discardLocal(l.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                data-test="unverified-discard"
                title="Remove this imported contact"
              >
                Discard
              </button>
              {/* === INSERT START (22.16: merge button) === */}
              <button
                type="button"
                onClick={() => mergeLocal(l.id)}
                className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700"
                data-test="unverified-merge"
                title="Merge this imported contact into an existing lead"
              >
                Merge
              </button>
              {/* === INSERT END === */}
              <button
                type="button"
                onClick={() => confirmLocal(l.id)}
                className="rounded bg-green-600 px-2 py-1 text-xs text-white"
                data-test="unverified-verify"
                title="Confirm this as a valid contact"
              >
                Verify
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
