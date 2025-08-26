// components/leads/LeadsClientTable.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import LeadActions from '@/components/leads/LeadActions';
import { toast } from 'sonner';

type Lead = {
  id: string;
  patient_name?: string | null;
  phone?: string | null;
  note?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Provider = { id: string; slug: string; display_name?: string | null };

// --- safety helpers ---
const safeArray = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

async function logEvent(payload: {
  event: 'wa.reminder.sent' | 'wa.rebook.sent';
  provider_slug?: string;
  provider_id?: string;
  lead_id?: string;
  source: any;
  ts?: number;
}) {
  try {
    await fetch('/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: Date.now(), ...payload }),
    });
  } catch (e) {
    console.warn('bulk events/log failed', e);
  }
}

function buildReminderText(lead: Lead, provider: Provider) {
  const name = (lead.patient_name || '').trim();
  const prov = (provider.display_name || provider.slug || 'your provider').trim();
  return `Hi${name ? ' ' + name : ''}, reminder for your booking with ${prov}. Reply YES to confirm or pick another time: https://vyapr.com/book/${provider.slug}`;
}

function buildRebookText(lead: Lead, provider: Provider) {
  const name = (lead.patient_name || '').trim();
  const prov = (provider.display_name || provider.slug || 'your provider').trim();
  return `Hi${name ? ' ' + name : ''}, we missed you last time with ${prov}. Want to pick a slot this week? https://vyapr.com/book/${provider.slug}`;
}

const encode = (s: string) => encodeURIComponent(s);

export default function LeadsClientTable({
  rows: rowsProp,
  provider,
}: {
  rows?: Lead[]; // make prop optional defensively
  provider: Provider;
}) {
  // guard against undefined rows during first render/streaming
  const rows = safeArray(rowsProp);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectedLeads = useMemo(
    () => rows.filter((r) => r?.phone && selected.has(r.id)),
    [rows, selected]
  );

  const doBulk = useCallback(
    async (kind: 'reminder' | 'rebook', action: 'open' | 'copy') => {
      if (selectedLeads.length === 0) {
        toast.message('No leads selected', { duration: 1400 });
        return;
      }

      const batch = selectedLeads.slice(0, 6); // popup-safe cap
      let opened = 0;
      let copied = 0;

      for (const lead of batch) {
        const rawText =
          kind === 'reminder'
            ? buildReminderText(lead, provider)
            : buildRebookText(lead, provider);

        try {
          await navigator.clipboard.writeText(rawText);
          copied++;
        } catch {}

        const phone = (lead.phone || '').replace(/[^\d+]/g, '');
        const url =
          action === 'open'
            ? `https://web.whatsapp.com/send?phone=${encode(phone)}&text=${encode(rawText)}`
            : '';

        if (action === 'open') {
          const w = window.open(url, '_blank', 'noopener,noreferrer');
          if (w) opened++;
        }

        // per-lead telemetry
        logEvent({
          event: kind === 'reminder' ? 'wa.reminder.sent' : 'wa.rebook.sent',
          provider_slug: provider.slug,
          provider_id: provider.id,
          lead_id: lead.id,
          source: { via: 'ui', bulk: true, to: batch.length, opened: action === 'open', copied: true },
        });
      }

      toast.message(
        action === 'open'
          ? `Opened ${opened}/${batch.length}; messages copied.`
          : `Copied ${copied}/${batch.length} messages.`,
        { duration: 1800 }
      );
    },
    [selectedLeads, provider]
  );

  return (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 rounded border hover:bg-gray-50"
          onClick={() => doBulk('reminder', 'open')}
          disabled={selectedLeads.length === 0}
          title={selectedLeads.length === 0 ? 'Select rows first' : 'Open WhatsApp Web for selected'}
        >
          Bulk ▸ Open Reminders
        </button>
        <button
          className="px-2 py-1 rounded border hover:bg-gray-50"
          onClick={() => doBulk('rebook', 'open')}
          disabled={selectedLeads.length === 0}
          title={selectedLeads.length === 0 ? 'Select rows first' : 'Open WhatsApp Web for selected'}
        >
          Bulk ▸ Open Rebooking
        </button>
        <button
          className="px-2 py-1 rounded border hover:bg-gray-50"
          onClick={() => doBulk('reminder', 'copy')}
          disabled={selectedLeads.length === 0}
          title={selectedLeads.length === 0 ? 'Select rows first' : 'Copy messages only'}
        >
          Bulk ▸ Copy Reminders
        </button>
        <button
          className="px-2 py-1 rounded border hover:bg-gray-50"
          onClick={() => doBulk('rebook', 'copy')}
          disabled={selectedLeads.length === 0}
          title={selectedLeads.length === 0 ? 'Select rows first' : 'Copy messages only'}
        >
          Bulk ▸ Copy Rebooking
        </button>
        <span className="text-sm text-gray-500 ml-2">Selected: {selectedLeads.length}</span>
      </div>

      {/* Table */}
      <div className="rounded border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      disabled={!r?.phone}
                      title={!r?.phone ? 'No phone on lead' : 'Select'}
                    />
                  </td>
                  <td className="px-3 py-2">{r?.patient_name || '-'}</td>
                  <td className="px-3 py-2">{r?.phone || '-'}</td>
                  <td className="px-3 py-2">{r?.status || 'new'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r?.created_at
                      ? new Intl.DateTimeFormat('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Asia/Kolkata',
                        }).format(new Date(r.created_at))
                      : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <LeadActions lead={r} provider={provider} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-gray-500" colSpan={6}>
                  No leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
