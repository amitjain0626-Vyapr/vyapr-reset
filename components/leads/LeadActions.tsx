// components/leads/LeadActions.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { toast } from 'sonner';

type Lead = { id: string; patient_name?: string | null; phone?: string | null };
type Provider = { slug: string; id?: string; display_name?: string | null };

interface Props {
  lead: Lead;
  provider: Provider;
  className?: string;
}

const encode = (s: string) => encodeURIComponent(s);

const isMobile = () => {
  // Prefer UA-CH if available
  // @ts-ignore
  const ch = typeof navigator !== 'undefined' && (navigator as any).userAgentData;
  if (ch && typeof ch.mobile === 'boolean') return ch.mobile;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }
  return false;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

async function logEvent(payload: {
  event: 'wa.reminder.sent' | 'wa.rebook.sent';
  provider_slug?: string;
  provider_id?: string;
  lead_id?: string;
  source: any;
}) {
  try {
    const res = await fetch('/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: payload.event,
        provider_slug: payload.provider_slug,
        provider_id: payload.provider_id,
        lead_id: payload.lead_id,
        source: payload.source,
        ts: Date.now(),
      }),
    });
    if (!res.ok) console.warn('events/log non-200', res.status);
  } catch (e) {
    console.warn('events/log failed', e);
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

export function LeadActions({ lead, provider, className }: Props) {
  const disabled = !lead?.phone;

  const handleSend = useCallback(
    async (kind: 'reminder' | 'rebook') => {
      if (!lead?.phone) {
        toast.info('No phone on this lead');
        return;
      }

      const rawText =
        kind === 'reminder'
          ? buildReminderText(lead, provider)
          : buildRebookText(lead, provider);

      // Always copy first (fallback)
      const copied = await copyToClipboard(rawText);

      const phone = lead.phone.replace(/[^\d+]/g, ''); // keep + and digits
      const textParam = encode(rawText);

      const mobile = isMobile();
      let opened = false;

      try {
        if (mobile) {
          window.location.href = `https://wa.me/${phone}?text=${textParam}`;
          opened = true;
          toast.success('Opening WhatsApp… Message copied as backup.');
        } else {
          const url = `https://web.whatsapp.com/send?phone=${encode(phone)}&text=${textParam}`;
          const win = window.open(url, '_blank', 'noopener,noreferrer');
          opened = !!win;
          toast.success('Copied message. Opened WhatsApp Web (if available).');
        }
      } catch (e) {
        console.warn('WA open failed', e);
        toast.success(copied ? 'Copied message to clipboard.' : 'Tried to copy message.');
      }

      // Telemetry (non-blocking)
      logEvent({
        event: kind === 'reminder' ? 'wa.reminder.sent' : 'wa.rebook.sent',
        provider_slug: provider.slug,
        provider_id: provider.id,
        lead_id: lead.id,
        source: { via: 'ui', bulk: false, to: 1, opened, copied },
      });
    },
    [lead, provider]
  );

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => handleSend('reminder')}
        disabled={disabled}
        title={disabled ? 'No phone on lead' : 'Send WhatsApp Reminder'}
        className={`px-2 py-1 rounded border ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        Send WA Reminder
      </button>
      <button
        type="button"
        onClick={() => handleSend('rebook')}
        disabled={disabled}
        title={disabled ? 'No phone on lead' : 'Send WhatsApp Rebooking'}
        className={`ml-2 px-2 py-1 rounded border ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        Send Rebooking
      </button>
    </div>
  );
}

// ✅ Default export to satisfy files importing `import LeadActions from '@/components/leads/LeadActions'`
export default LeadActions;
