'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import LeadDialog from './LeadDialog';

type Lead = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  status: 'new' | 'open' | 'closed' | null;
  source: string | null;
  created_at: string;
};

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const [selected, setSelected] = useState<Lead | null>(null);

  const rows = useMemo(() => leads, [leads]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 text-left text-sm font-semibold text-gray-600">
            <tr>
              <th className="px-4 py-3 w-[22%]">Patient</th>
              <th className="px-4 py-3 w-[18%]">Phone</th>
              <th className="px-4 py-3 w-[18%]">Source</th>
              <th className="px-4 py-3 w-[18%]">Status</th>
              <th className="px-4 py-3 w-[24%]">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {rows.map((lead) => (
              <tr
                key={lead.id}
                className={clsx(
                  'cursor-pointer hover:bg-gray-50 transition-colors'
                )}
                onClick={() => setSelected(lead)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {lead.patient_name || '—'}
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-1">
                    {lead.note || 'No note'}
                  </div>
                </td>
                <td className="px-4 py-3">{lead.phone || '—'}</td>
                <td className="px-4 py-3">{lead.source || 'microsite'}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                      {
                        'bg-amber-50 text-amber-700 ring-1 ring-amber-200':
                          lead.status === 'new' || !lead.status,
                        'bg-blue-50 text-blue-700 ring-1 ring-blue-200':
                          lead.status === 'open',
                        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200':
                          lead.status === 'closed',
                      }
                    )}
                  >
                    • {lead.status ?? 'new'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {new Date(lead.created_at).toLocaleString()}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <LeadDialog lead={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
