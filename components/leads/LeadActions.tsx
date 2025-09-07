// components/leads/LeadActions.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { waReminder, waRebook } from '@/lib/wa/templates';

// === VYAPR: Role resolver (22.15) START ===
async function getProviderRole(slug: string): Promise<string> {
  try {
    const res = await fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const j: any = await res.json().catch(() => null);
    const raw = (j?.category || j?.provider?.category || '').toString().trim();
    if (!raw) return '';
    const map: Record<string, string> = {
      dentist: 'Dentist',
      dental: 'Dentist',
      astro: 'Astrologer',
      astrologer: 'Astrologer',
      physio: 'Physiotherapist',
      physiotherapist: 'Physiotherapist',
      derma: 'Dermatologist',
      dermatologist: 'Dermatologist',
      yoga: 'Yoga Instructor',
      'gym-trainer': 'Fitness Coach',
      salon: 'Stylist',
      tutor: 'Tutor',
    };
    const k = raw.toLowerCase();
    return map[k] || (raw.charAt(0).toUpperCase() + raw.slice(1));
  } catch {
    return '';
  }
}
// === VYAPR: Role resolver (22.15) END ===

type Lead = { id: string; patient_name?: string | null; phone?: string | null };
type Provider = { slug: string; id?: string; display_name?: string | null };

interface Props {
  lead: Lead;
  provider: Provider;
  className?: string;
}

const encode = (s: string) => encodeURIComponent(s);

const isMobile = () => {
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
  event: string;
  provider_slug?: string;
  provider_id?: string;
  lead_id?: string;
  source: any;
}) {
  try {
    await fetch('/api/events/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ts: Date.now() }),
    });
  } catch {}
}

/* ===================== Retention Playbooks bridge ===================== */
async function openPlaybook(
  kind: 'no_show_followup' | 'reactivation_nudge' | 'pre_booking_reminder',
  lead: Lead,
  provider: Provider
) {
  try {
    const url = new URL('/api/templates/preview', window.location.origin);
    url.searchParams.set('slug', provider.slug);
    url.searchParams.set('lead_id', lead.id);
    url.searchParams.set('kind', kind);

    // pass customer name (if we have it)
    const name = (lead?.patient_name || '').trim();
    if (name) url.searchParams.set('name', name);

    // NEW: pass provider display name when present
    const provName = (provider?.display_name || '').trim();
    if (provName) url.searchParams.set('provider', provName);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json().catch(() => ({} as any));
    const deeplink = json?.wa_deeplink || '';

    if (!deeplink) {
      toast.error('Could not build WhatsApp message');
      return;
    }

    if (isMobile()) {
      window.location.href = deeplink;
    } else {
      window.open(deeplink, '_blank');
    }

    const event = kind === 'reactivation_nudge' ? 'wa.reactivation.sent' : 'wa.reminder.sent';
    logEvent({
      event,
      provider_slug: provider.slug,
      provider_id: provider.id,
      lead_id: lead.id,
      source: { via: 'ui', playbook: kind },
    });
  } catch {
    toast.error('Preview failed');
  }
}
/* =================== /Retention Playbooks bridge ====================== */

// --- Build tracked booking URL ---
function trackedBookingUrl(opts: {
  slug: string;
  leadId: string;
  campaign: string;
  utm_source: 'whatsapp' | 'sms' | 'qr' | 'direct';
  utm_medium: 'message' | 'scan' | 'link';
}) {
  const origin =
    (typeof window !== 'undefined' && window.location && window.location.origin) ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://vyapr-reset-5rly.vercel.app';

  const q = new URLSearchParams({
    lid: opts.leadId,
    utm_source: opts.utm_source,
    utm_medium: opts.utm_medium,
    utm_campaign: opts.campaign || 'direct',
  });

  return `${origin}/book/${opts.slug}?${q.toString()}`;
}

function buildReminderText(lead: Lead, provider: Provider, campaign?: string) {
  ts // --- Resolve friendly provider role (Dentist → “Dentist”, physio → “Physiotherapist”) --- async function getProviderRole(slug: string): Promise<string> { try { const res = await fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: 'no-store' }); const j: any = await res.json().catch(() => null); const raw = (j?.category || j?.provider?.category || '').toString().trim(); if (!raw) return ''; const map: Record<string, string> = { dentist: 'Dentist', dental: 'Dentist', astro: 'Astrologer', astrologer: 'Astrologer', physio: 'Physiotherapist', physiotherapist: 'Physiotherapist', yoga: 'Yoga Instructor', 'gym-trainer': 'Fitness Coach', salon: 'Stylist', derma: 'Dermatologist', dermatologist: 'Dermatologist', tutor: 'Tutor', }; const k = raw.toLowerCase(); return map[k] || (raw.charAt(0).toUpperCase() + raw.slice(1)); } catch { return ''; } } ``` 2 lines after ```ts const name = (lead.patient_name || '').trim();  
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

  const [campaign, setCampaign] = useState<
    'direct' | 'whatsapp' | 'sms' | 'instagram' | 'qr' | 'confirm' | 'noshow' | 'reactivation'
  >('direct');

  useEffect(() => {
    try {
      const v = localStorage.getItem('vyapr.rowCampaign');
      if (v) setCampaign(v as any);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('vyapr.rowCampaign', campaign);
    } catch {}
  }, [campaign]);

  // handlers for playbooks
  const sendNoShow = useCallback(() => openPlaybook('no_show_followup', lead, provider), [lead, provider]);
  const sendReactivate = useCallback(() => openPlaybook('reactivation_nudge', lead, provider), [lead, provider]);
  const sendPreBooking = useCallback(() => openPlaybook('pre_booking_reminder', lead, provider), [lead, provider]);

  const handleSend = useCallback(
    async (kind: 'reminder' | 'rebook') => {
      // Optional “, your <role>” phrasing — fetched from provider.category const role = await getProviderRole(provider.slug); ``` 2 lines after ```ts let rawText = kind === 'reminder' ? buildReminderText(lead, provider, campaign) : buildRebookText(lead, provider, campaign);
       // === VYAPR: Role phrase (22.15) START ===
      const role = await getProviderRole(provider.slug);
      if (role) {
        // soften phrasing: "your Dentist." instead of bare "team."
        rawText = rawText.replace('team.', `team, your ${role}.`);
      }
      // === VYAPR: Role phrase (22.15) END ===
      if (!hasPhone) {
        toast.message('No phone on lead', { duration: 1500 });
        return;
      }
      let rawText =
        kind === 'reminder'
          ? buildReminderText(lead, provider, campaign)
          : buildRebookText(lead, provider, campaign);

      const tracked = trackedBookingUrl({
        // If we have a role, convert: // "this is Amit Jain's team." → "this is Amit Jain's team, your Dentist." if (role) { rawText = rawText.replace('team.', `team, your ${role}.`); } ``` 2 lines after ```ts campaign, utm_source: 'whatsapp',
        slug: provider.slug,
        leadId: lead.id,
        campaign,
        utm_source: 'whatsapp',
        utm_medium: 'message',
      });
      if (!rawText.includes(tracked)) rawText += `\n\n${tracked}`;

      await copyToClipboard(rawText);
      const phone = (lead.phone || '').replace(/[^\d+]/g, '');
      const textParam = encode(rawText);

      if (isMobile()) {
        window.location.href = `https://wa.me/${phone}?text=${textParam}`;
      } else {
        window.open(`https://web.whatsapp.com/send?phone=${encode(phone)}&text=${textParam}`, '_blank');
      }

      logEvent({
        event: kind === 'reminder' ? 'wa.reminder.sent' : 'wa.rebook.sent',
        provider_slug: provider.slug,
        provider_id: provider.id,
        lead_id: lead.id,
        source: { via: 'ui', bulk: false, to: phone, campaign },
      });
    },
    [hasPhone, lead, provider, campaign]
  );

  // --- SMS mirror ---
  const handleSms = useCallback(async () => {
    if (!hasPhone) {
      toast.message('No phone on lead', { duration: 1500 });
      return;
    }
    let body = buildReminderText(lead, provider, campaign);
    const tracked = trackedBookingUrl({
      slug: provider.slug,
      leadId: lead.id,
      campaign,
      utm_source: 'sms',
      utm_medium: 'message',
    });
    if (!body.includes(tracked)) body += `\n\n${tracked}`;
    const phone = (lead.phone || '').replace(/[^\d+]/g, '');
    const textParam = encode(body);
    const url = isiOS() ? `sms:${phone}&body=${textParam}` : `sms:${phone}?body=${textParam}`;
    try {
      window.location.href = url;
    } catch {}

    logEvent({
      event: 'sms.reminder.sent',
      provider_slug: provider.slug,
      provider_id: provider.id,
      lead_id: lead.id,
      source: { via: 'sms', bulk: false, to: phone, campaign },
    });
  }, [hasPhone, lead, provider, campaign]);

  const handleQR = useCallback(async () => {
    const tracked = trackedBookingUrl({
      slug: provider.slug,
      leadId: lead.id,
      campaign,
      utm_source: 'qr',
      utm_medium: 'scan',
    });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encode(tracked)}`;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `vyapr-qr-${(provider.slug || 'link')}-${(lead.id || '').slice(0, 6)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [provider.slug, lead.id, campaign]);

  const handleCopyLink = useCallback(async () => {
    const tracked = trackedBookingUrl({
      slug: provider.slug,
      leadId: lead.id,
      campaign,
      utm_source: 'direct',
      utm_medium: 'link',
    });
    const ok = await copyToClipboard(tracked);
    toast.success(ok ? 'Booking link copied' : 'Tried to copy link');
  }, [provider.slug, lead.id, campaign]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => { setCampaign('confirm'); toast.message('Preset: Confirm'); }} className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50">✅ Confirm</button>
        <button type="button" onClick={() => { setCampaign('noshow'); toast.message('Preset: No-show recovery'); }} className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50">⏰ No-show</button>
        <button type="button" onClick={() => { setCampaign('reactivation'); toast.message('Preset: Reactivation'); }} className="px-2 py-0.5 rounded border text-xs hover:bg-gray-50">🔄 Reactivate</button>
      </div>

      {/* Campaign selector */}
      <label className="text-xs text-gray-500">Camp.</label>
      <select value={campaign} onChange={(e) => setCampaign(e.target.value as any)} className="px-2 py-1 rounded border text-sm">
        <option value="direct">Direct</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
        <option value="instagram">Instagram</option>
        <option value="qr">QR</option>
        <option value="confirm">confirm</option>
        <option value="noshow">noshow</option>
        <option value="reactivation">reactivation</option>
      </select>

      <button type="button" onClick={() => handleSend('reminder')} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`}>💬 WA Reminder</button>
      <button type="button" onClick={() => handleSend('rebook')} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`}>↩️ Rebooking</button>
      <button type="button" onClick={handleCopyLink} className="px-2 py-1 rounded border text-sm hover:bg-gray-50">🔗 Copy Link</button>
      <button type="button" onClick={handleSms} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`}>📩 SMS</button>
      <button type="button" onClick={handleQR} className="px-2 py-1 rounded border text-sm hover:bg-gray-50">🖨️ QR</button>

      {/* Retention Playbooks — one-click WA */}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={sendNoShow} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`} title="Send a no-show recovery message on WA">⏰ No-show (WA)</button>
        <button type="button" onClick={sendReactivate} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`} title="Send a reactivation nudge on WA">🔄 Reactivate (WA)</button>
        <button type="button" onClick={sendPreBooking} disabled={!hasPhone} className={`px-2 py-1 rounded border text-sm ${disabledCls}`} title="Send a pre-booking confirmation on WA">🗓️ Pre-book (WA)</button>
      </div>

      {/* micro-upsell chip */}
      <a href={`/upsell?slug=${encodeURIComponent(provider.slug)}&lid=${encodeURIComponent(lead.id)}`} className="text-[11px] rounded-full border px-2 py-0.5 text-indigo-700 border-indigo-300 hover:bg-indigo-50" title="Get more visibility & ready-made message templates">⭐ Boost</a>
    </div>
  );
}
