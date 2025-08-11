// components/payments/PaymentsTable.tsx
// @ts-nocheck
export default function PaymentsTable({ payments = [] }) {
  if (!Array.isArray(payments) || payments.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-gray-600 text-sm">
        No payments yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2">Date</th>
            <th className="text-left px-4 py-2">Amount</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-4 py-2">
                {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-2">{p.amount ?? '—'}</td>
              <td className="px-4 py-2">{p.status ?? '—'}</td>
              <td className="px-4 py-2 max-w-xs truncate" title={p.notes ?? ''}>
                {p.notes ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
