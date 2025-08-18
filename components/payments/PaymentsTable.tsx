'use client';

// @ts-nocheck
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import PaymentDialog from './PaymentDialog';

// We keep the type loose; we only read common fields
type AnyPayment = {
  id: string;
  created_at?: string;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  method?: string | null;
  source?: string | null;
  note?: string | null;
  payer_name?: string | null;
  phone?: string | null;
  [key: string]: any;
};

export default function PaymentsTable({ payments }: { payments: AnyPayment[] }) {
  const [selected, setSelected] = useState<AnyPayment | null>(null);
  const rows = useMemo(() => payments, [payments]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-left text-sm font-semibold text-gray-600">
            <tr>
              <th className="px-4 py-3 w-[18%]">Payer</th>
              <th className="px-4 py-3 w-[18%]">Amount</th>
              <th className="px-4 py-3 w-[18%]">Method</th>
              <th className="px-4 py-3 w-[18%]">Status</th>
              <th className="px-4 py-3 w-[28%]">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {rows.map((p) => {
              const amount =
                typeof p.amount === 'number'
                  ? p.amount
                  : Number(p.amount ?? 0) || undefined;

              const currency = p.currency || 'INR';
              const displayAmount =
                typeof amount === 'number' ? `${currency} ${amount.toFixed(2)}` : '—';

              const created = p.created_at
                ? new Date(p.created_at).toLocaleString()
                : '—';

              return (
                <tr
                  key={p.id}
                  className={clsx('cursor-pointer hover:bg-gray-50 transition-colors')}
                  onClick={() => setSelected(p)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {p.payer_name || '—'}
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-1">
                      {p.phone || p.source || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">{displayAmount}</td>
                  <td className="px-4 py-3">{p.method || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        {
                          'bg-amber-50 text-amber-700 ring-1 ring-amber-200':
                            (p.status ?? 'new') === 'new' || p.status === 'pending',
                          'bg-blue-50 text-blue-700 ring-1 ring-blue-200':
                            p.status === 'paid' || p.status === 'success',
                          'bg-rose-50 text-rose-700 ring-1 ring-rose-200':
                            p.status === 'failed' || p.status === 'refunded',
                          'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200':
                            p.status === 'settled' || p.status === 'captured',
                        }
                      )}
                    >
                      • {p.status ?? 'new'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{created}</td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <PaymentDialog payment={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
