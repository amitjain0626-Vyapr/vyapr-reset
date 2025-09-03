// app/components/leads/UnverifiedImports.tsx
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
  if (!Array.isArray(leads) || leads.length === 0) {
    return (
      <div className="rounded border border-gray-200 p-3 text-sm text-gray-500">
        No unverified leads right now.
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3">
      <div className="mb-2 text-sm font-medium text-amber-900">
        Imported (needs verification)
      </div>
      <ul className="space-y-2">
        {leads.map((l) => (
          <li
            key={l.id}
            className="flex items-center justify-between rounded border border-amber-200 bg-white p-2"
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
                onClick={() => onDiscard(l.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => onVerify(l.id)}
                className="rounded bg-green-600 px-2 py-1 text-xs text-white"
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
