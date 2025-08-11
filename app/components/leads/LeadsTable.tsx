// components/leads/LeadsTable.tsx
// @ts-nocheck
export default function LeadsTable({ leads = [] }) {
  if (!Array.isArray(leads) || leads.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-gray-600 text-sm">
        No leads yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Phone</th>
            <th className="text-left px-4 py-2">Note</th>
            <th className="text-left px-4 py-2">Microsite</th>
            <th className="text-left px-4 py-2">Received</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-4 py-2">{l.name ?? '—'}</td>
              <td className="px-4 py-2 font-mono">{l.phone ?? '—'}</td>
              <td className="px-4 py-2 max-w-xs truncate" title={l.note ?? ''}>
                {l.note ?? '—'}
              </td>
              <td className="px-4 py-2">{l.microsite_slug ?? '—'}</td>
              <td className="px-4 py-2">
                {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
