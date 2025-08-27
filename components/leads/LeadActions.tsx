// components/leads/LeadActions.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { waReminder, waRebook, waBookingLink } from '@/lib/wa/templates';

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

const isiOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
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

function buildReminderText(lead: Lead, provider: Provider, campaign?: string) {
  const name = (lead.patient_name || '').trim();
  const prov = (provider.display_name || provider.slug || 'your provider').trim();
  return waReminder({ name, provider: prov, slug: provider.slug, leadId: lead.id, campaign });
}

function buildRebookText(lead: Lead, provider: Provider, campaign?: string) {
  const name = (lead.patient_name || '').trim();
  const prov = (provider.display_name || provider.slug || 'your provider').trim();
  return waRebook({ name, provider: prov, slug: provider.slug, leadId: lead.id, campaign });
}

export default function LeadActions({ lead, provider, className }: Props) {
  const hasPhone = !!(lead?.phone && String(lead.phone).trim());
  const disabledCls = hasPhone ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed';
  const reminderTitle = hasPhone ? '💬 Send WhatsApp reminder' : 'No phone on lead';
  const rebookTitle = hasPhone ? '↩️ Send WhatsApp rebooking' : 'No phone on lead';

  // Campaign selector (drives utm_campaign across all actions)
  const [campaign, setCampaign] = useState<
    'direct' | 'whatsapp' | 'sms' | 'instagram' | 'qr' |
    'confirm' | 'noshow' | 'reactivation'
  >('direct');

  const handleSend = useCallback(
    async (kind: 'reminder' | 'rebook') => {
      if (!hasPhone) {
        toast.message('No phone on lead', { duration: 1500 });
        return;
      }

      const rawText =
        kind === 'reminder'
          ? buildReminderText(lead, provider, campaign)
          : buildRebookText(lead, provider, campaign);

      // Always copy first (fallback)
      const copied = await copyToClipboard(rawText);

      const phone = (lead.phone || '').replace(/[^\d+]/g, ''); // keep + and digits
      const textParam = encode(rawText);

      const mobile = isMobile();
      let opened = false;

      try {
        if (mobile) {
          window.location.href = `https://wa.me/${phone}?text=${textParam}`;
          opened = true;
          toast.message('Opening WhatsApp…', { duration: 1200 });
        } else {
          const url = `https://web.whatsapp.com/send?phone=${encode(phone)}&text=${textParam}`;
          const win = window.open(url, '_blank', 'noopener,noreferrer');
          opened = !!win;
          toast.message('Copied. Opening WhatsApp Web…', { duration: 1600 });
        }
      } catch {
        toast.message(copied ? 'Copied.' : 'Tried to copy.', { duration: 1400 });
      }

      // Telemetry (non-blocking) — keep within approved events
      logEvent({
        event: kind === 'reminder' ? 'wa.reminder.sent' : 'wa.rebook.sent',
        provider_slug: provider.slug,
        provider_id: provider.id,
        lead_id: lead.id,
        source: { via: 'ui', bulk: false, to: phone, opened, copied, campaign },
      });
    },
    [hasPhone, lead, provider, campaign]
  );

  // SMS compose (reminder text)
  const handleSms = useCallback(async () => {
    if (!hasPhone) {
      toast.message('No phone on lead', { duration: 1500 });
      return;
    }
    const body = buildReminderText(lead, provider, campaign);
    const phone = (lead.phone || '').replace(/[^\d+]/g, '');
    const textParam = encode(body);
    const url = isiOS()
      ? `sms:${phone}&body=${textParam}`
      : `sms:${phone}?body=${textParam}`;
    try {
      window.location.href = url;
    } catch {}
  }, [hasPhone, lead, provider, campaign]);

  // Download QR (PNG) for the tracked booking link (no deps)
  const handleQR = useCallback(async () => {
    const tracked = waBookingLink({ slug: provider.slug, leadId: lead.id, campaign });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encode(tracked)}`;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `vyapr-qr-${(provider.slug || 'link')}-${(lead.id || '').slice(0, 6)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [provider.slug, lead.id, campaign]);

  return (
    // Wrap + gap so row never distorts on small widths
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      {/* Presets: set campaign quickly */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => { setCampaign('confirm'); toast.message('Preset: Confirm'); }}
          className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50"
          title="Use confirm preset"
        >
          ✅ Confirm
        </button>
        <button
          type="button"
          onClick={() => { setCampaign('noshow'); toast.message('Preset: No-show recovery'); }}
          className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50"
          title="Use no-show recovery preset"
        >
          ⏰ No-show
        </button>
        <button
          type="button"
          onClick={() => { setCampaign('reactivation'); toast.message('Preset: Reactivation'); }}
          className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50"
          title="Use reactivation preset"
        >
          🔄 Reactivate
        </button>
      </div>

      {/* Campaign selector (shows current tag) */}
      <label className="text-xs text-gray-500">Camp.</label>
      <select
        value={campaign}
        onChange={(e) => setCampaign(e.target.value as any)}
        className="px-2 py-1 rounded border text-sm"
        title="Choose campaign tag"
      >
        <option value="direct">Direct</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
        <option value="instagram">Instagram</option>
        <option value="qr">QR</option>
        <option value="confirm">confirm</option>
        <option value="noshow">noshow</option>
        <option value="reactivation">reactivation</option>
      </select>

      <button
        type="button"
        onClick={() => handleSend('reminder')}
        disabled={!hasPhone}
        title={reminderTitle}
        className={`px-2 py-1 rounded border text-sm ${disabledCls}`}
      >
        💬 WA Reminder
      </button>

      <button
        type="button"
        onClick={() => handleSend('rebook')}
        disabled={!hasPhone}
        title={rebookTitle}
        className={`px-2 py-1 rounded border text-sm ${disabledCls}`}
      >
        ↩️ Rebooking
      </button>

      {/* Copy tracked booking link (uses selected campaign) */}
      <button
        type="button"
        onClick={async () => {
          const link = waBookingLink({ slug: provider.slug, leadId: lead.id, campaign });
          const ok = await copyToClipboard(link);
          toast.success(ok ? 'Booking link copied' : 'Tried to copy link');
        }}
        title="🔗 Copy tracked booking link"
        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
      >
        🔗 Copy Link
      </button>

      {/* SMS compose */}
      <button
        type="button"
        onClick={handleSms}
        disabled={!hasPhone}
        title="📩 Open SMS composer"
        className={`px-2 py-1 rounded border text-sm ${disabledCls}`}
      >
        📩 SMS
      </button>

      {/* Download QR */}
      <button
        type="button"
        onClick={handleQR}
        title="🖨️ Download QR PNG"
        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
      >
        🖨️ QR
      </button>
    </div>
  );
}
