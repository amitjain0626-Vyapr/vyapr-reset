// app/dashboard/nudges/page.tsx
// @ts-nocheck
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
// === VYAPR: Batch Send (22.15) START ===
import Script from 'next/script';
// === VYAPR: Batch Send (22.15) END ===

/* -------- supabase admin -------- */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* -------- types -------- */
type Provider = { id: string; slug: string; display_name?: string | null };
type NudgeEvent = { lead_id: string | null; ts: number; source: any };
type UpsellResp = {
  ok: boolean;
  slug: string;
  nudges: Array<{ key: string; label: string; kind: string; action_url: string; meta?: any }>;
} | null;

/* -------- nudges config (quiet-hours / caps) -------- */
type NudgesConfig = {
  ok: boolean;
  provider_id: string | null;
  is_quiet: boolean;
  allowed: boolean;
  remaining: number;
  windowHours?: number;
  config?: { quiet_start?: number; quiet_end?: number; cap?: number };
};

async function fetchNudgesConfig(slug: string): Promise<NudgesConfig | null> {
  const origin = process.env.NEXT_PUBLIC_BASE_URL || 'https://vyapr-reset-5rly.vercel.app';
  try {
    const r = await fetch(`${origin}/api/cron/nudges?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) return null;
    return j as NudgesConfig;
  } catch {
    return null;
  }
}

/* -------- data -------- */
async function fetchProvider(slug: string): Promise<Provider> {
  const { data, error } = await admin()
    .from('Providers')
    .select('id, slug, display_name')
    .eq('slug', slug)
    .single();
  if (error || !data?.id) throw new Error('provider_not_found');
  return data as Provider;
}

function parseWindow(windowToken?: string) {
  const t = (windowToken || '').toLowerCase().trim();
  if (t === 'd30') return { label: 'last 30 days', since: Date.now() - 30 * 24 * 60 * 60 * 1000, key: 'd30' };
  if (t === 'h24') return { label: 'last 24 hours', since: Date.now() - 24 * 60 * 60 * 1000, key: 'h24' };
  // default (WIDEN to surface older suggestions easily)
  return { label: 'last 30 days', since: Date.now() - 30 * 24 * 60 * 60 * 1000, key: 'd30' };
}

async function fetchRecentNudges(providerId: string, sinceTs: number): Promise<NudgeEvent[]> {
  const { data = [] } = await admin()
    .from('Events')
    .select('lead_id, ts, source')
    .eq('provider_id', providerId)
    .eq('event', 'nudge.suggested')
    .gte('ts', sinceTs)
    .order('ts', { ascending: false })
    .limit(1000);
  return data as any[];
}

async function fetchLeadNames(leadIds: string[]) {
  if (!leadIds.length) return {};
  const { data = [] } = await admin().from('Leads').select('id, patient_name').in('id', leadIds);
  const map: Record<string, string> = {};
  for (const r of data) map[r.id] = (r.patient_name || '').toString();
  return map;
}

/* -------- upsell fallback (server) -------- */
async function fetchUpsell(slug: string): Promise<UpsellResp> {
  const origin = process.env.NEXT_PUBLIC_BASE_URL || 'https://vyapr-reset-5rly.vercel.app';
  try {
    const r = await fetch(`${origin}/api/upsell?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j?.ok || !Array.isArray(j?.nudges)) return null;
    return j as UpsellResp;
  } catch {
    return null;
  }
}

/* -------- helpers -------- */
function buildText(providerName: string, leadName?: string) {
  const hi = leadName?.trim() ? `Hi ${leadName.trim()},` : 'Hi!';
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    text: [
      hi,
      `This is a friendly reminder to complete your pending payment with ${providerName}.`,
      `You can pay here: https://vyapr-reset-5rly.vercel.app/pay/TEST`,
      `Ref: ${ref}`,
    ].join('\n'),
    ref,
  };
}

/* two lines before
   (helper section continues)
<< insert >>
   V2.3: add WA URL builder for opening WhatsApp with prefilled text
   Works for any country code; strips non-digits from phone.
two lines after */
function buildWAUrl({ phone, text }: { phone: string; text: string }) {
  const digits = (phone || '').replace(/[^\d]/g, '');
  const enc = encodeURIComponent(text || '');
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${enc}&type=phone_number&app_absent=0`;
}

function buildTrackedHref(args: {
  providerId: string;
  leadId: string | null;
  phoneDigits: string;
  text: string;
  ref: string;
}) {
  const p = new URLSearchParams();
  p.set('provider_id', args.providerId);
  if (args.leadId) p.set('lead_id', args.leadId);
  p.set('phone', args.phoneDigits.replace(/[^\d]/g, ''));
  p.set('text', args.text);
  p.set('ref', args.ref);
  return `/api/track/wa-collect?${p.toString()}`;
}

function maskDigits(d: string) {
  const s = d.replace(/[^\d]/g, '');
  if (s.length <= 4) return s;
  return `${s.slice(0, s.length - 4).replace(/\d/g, '•')}${s.slice(-4)}`;
}

/* -------- page -------- */
export default async function Page(props: { searchParams: Promise<{ slug?: string; window?: string }> }) {
  const { slug, window } = await props.searchParams;
  const _slug = (slug || '').trim();
  if (!_slug) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Nudge Center</h1>
        <p className="text-sm text-red-600 mt-2">Missing ?slug= in URL.</p>
      </main>
    );
  }

  let provider: Provider;
  try {
    provider = await fetchProvider(_slug);
  } catch {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Nudge Center</h1>
        <p className="text-sm text-red-600 mt-2">Provider not found for slug “{_slug}”.</p>
      </main>
    );
  }

  // Window parsing (d30 / h24 / default d30)
  const win = parseWindow(window);

  // Load nudges in the requested window
  const nudges = await fetchRecentNudges(provider.id, win.since);
  const leadIds = Array.from(new Set(nudges.map((n) => n.lead_id).filter(Boolean))) as string[];
  const nameMap = await fetchLeadNames(leadIds);

  const providerName = (provider.display_name || provider.slug || 'your provider').toString();

  // Fetch quiet-hours / caps
  const nudgesCfg = await fetchNudgesConfig(provider.slug);
  const quietStart = nudgesCfg?.config?.quiet_start ?? 22;
  const quietEnd = nudgesCfg?.config?.quiet_end ?? 8;
  const cap = nudgesCfg?.config?.cap ?? 25;
  const remaining = nudgesCfg?.remaining ?? 0;
  const isQuiet = !!nudgesCfg?.is_quiet;
  const allowedNow = !!nudgesCfg?.allowed;

  // Server-side upsell fallback if no suggested nudges in the chosen window
  const upsell = nudges.length === 0 ? await fetchUpsell(provider.slug) : null;
  const fallback = Array.isArray(upsell?.nudges) ? upsell!.nudges.slice(0, 4) : [];

  const switchHref = (key: 'h24' | 'd30') =>
    `/dashboard/nudges?slug=${encodeURIComponent(provider.slug)}&window=${key}`;

  return (
    // === VYAPR: add provider UUID for telemetry (22.15) START ===
    <main
      className="p-6 space-y-4"
      data-test="nudge-center-root"
      data-provider-id={provider.id}
    >
      {/* === VYAPR: add provider UUID for telemetry (22.15) END === */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Nudge Center</h1>
          <div className="text-sm text-gray-600">
            Provider: <span className="font-mono">{provider.slug}</span>
          </div>
          <div className="text-xs text-gray-500">Showing: {win.label}</div>
        </div>
        <a href={`/dashboard/leads?slug=${provider.slug}`} className="text-emerald-700 underline">
          ← Back to Leads
        </a>
      </div>

      {/* Window switcher */}
      <nav className="flex items-center gap-2">
        <a
          href={switchHref('h24')}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${
            win.key === 'h24' ? 'bg-black text-white border-black' : 'bg-white hover:shadow-sm'
          }`}
          data-test="win-h24"
        >
          Last 24h
        </a>
        <a
          href={switchHref('d30')}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${
            win.key === 'd30' ? 'bg-black text-white border-black' : 'bg-white hover:shadow-sm'
          }`}
          data-test="win-d30"
        >
          Last 30d
        </a>
      </nav>

      {/* Schedule & limits summary */}
      <section
        className={`rounded-lg border p-4 ${allowedNow ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
        data-test="nudge-config"
      >
        <div className="text-sm font-medium">Schedule & limits</div>
        <div className="mt-1 text-sm text-gray-700">
          Quiet hours (IST): <span className="font-mono">{quietStart}:00 → {quietEnd}:00</span> ·{' '}
          Daily cap: <span className="font-mono">{cap}</span> ·{' '}
          Remaining today: <span className="font-mono">{remaining}</span> ·{' '}
          Status:{' '}
          <span className={`font-medium ${allowedNow ? 'text-emerald-700' : 'text-amber-700'}`}>
            {allowedNow ? 'Sends allowed now' : isQuiet ? 'Quiet hours' : 'Cap exhausted'}
          </span>
        </div>
      </section>

      <div className="rounded-lg border p-4 bg-white">
        <div className="text-sm text-gray-600">Suggested WhatsApp reminders from {win.label}.</div>
      </div>

      {/* Batch send summary (quiet-hours + cap aware) */}
      <section
        className="rounded-xl border p-4 bg-white"
        data-test="nudge-batch-ui"
        data-ready={Math.max(0, Math.min(remaining, nudges.length))}
        data-total={nudges.length}
        data-remaining={remaining}
        data-isquiet={isQuiet ? '1' : '0'}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Batch send (summary)</div>
            <div className="text-xs text-gray-600 mt-1">
              Ready to send now:{' '}
              <span className="font-mono">{Math.max(0, Math.min(remaining, nudges.length))}</span>{' '}
              of <span className="font-mono">{nudges.length}</span> suggestions · Remaining today:{' '}
              <span className="font-mono">{remaining}</span> · Quiet hours:{' '}
              <span className="font-mono">{isQuiet ? 'ON' : 'OFF'}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={isQuiet || remaining <= 0 || nudges.length === 0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              isQuiet || remaining <= 0 || nudges.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'
            }`}
            title={
              isQuiet
                ? 'Quiet hours active — sends paused'
                : remaining <= 0
                ? 'Daily cap exhausted'
                : 'Next step will enable batch opening'
            }
          >
            Batch send
          </button>
        </div>
      </section>

      {/* Fallback actions when there are no recent nudge.suggested events */}
      {nudges.length === 0 && fallback.length > 0 && (
        <section className="rounded-xl border p-4 bg-white">
          <div className="text-sm font-semibold mb-2">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            {fallback.map((n) => {
              const to = n.action_url || '#';
              const tracked = `/api/events/redirect?event=${encodeURIComponent(
                'upsell.nudge.clicked'
              )}&slug=${encodeURIComponent(provider.slug)}&key=${encodeURIComponent(n.key)}&to=${encodeURIComponent(to)}`;
              return (
                <a
                  key={n.key}
                  href={tracked}
                  className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:shadow-sm"
                >
                  {n.label}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* List with PREVIEW bubble */}
      <div className="space-y-3">
        {nudges.length === 0 && fallback.length === 0 && (
          <div className="text-sm text-gray-500">No suggestions right now.</div>
        )}

        {nudges.map((n, idx) => {
          const phone = (n?.source?.target || '').toString();
          const leadId = (n?.lead_id || null) as string | null;
          const leadName = leadId ? nameMap[leadId] : '';
          const { text, ref } = buildText(providerName, leadName);
          const href = buildTrackedHref({
            providerId: provider.id,
            leadId,
            phoneDigits: phone,
            text,
            ref,
          });

          return (
            <div key={idx} className="rounded-xl border p-3 bg-white" data-test="nudge-item">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{leadName ? leadName : 'Lead'} — {maskDigits(phone)}</div>
                  <div className="text-xs text-gray-500">Suggested at {new Date(n.ts).toLocaleString('en-IN')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    title="Open WhatsApp with prefilled reminder"
                    data-test="nudge-send"
                  >
                    Send on WhatsApp
                  </a>

                  {/* two lines before
                      (existing CTA group ends with the WA link above)
                  << insert >>
                      V2.3: “Collect ₹” CTA — fetches server-templated copy & opens WhatsApp
                      Works even when amount isn’t present in event source.
                  two lines after */}
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium border hover:shadow-sm"
                    title="Collect pending payment"
                    onClick={async () => {
                      try {
                        const lang = 'en'; // default language
                        const amt =
                          (n?.source?.amount_inr ?? n?.source?.pending ?? n?.source?.amount) || '';
                        const params = new URLSearchParams();
                        params.set('slug', provider.slug);
                        params.set('template', 'collect_pending');
                        if (amt) params.set('amt', String(amt));
                        params.set('lang', lang);

                        const r = await fetch(`/api/templates/preview?${params.toString()}`, { cache: 'no-store' });
                        const j = await r.json().catch(() => ({} as any));
                        const serverText = (j?.preview?.text || '').toString();

                        const phoneDigits = (phone || '').replace(/[^\d]/g, '');
                        if (!phoneDigits) return;

                        const text = serverText || [
                          (leadName ? `Hi ${leadName},` : 'Hi,'),
                          `Please complete your pending payment with ${providerName}.`,
                          `Pay here: https://vyapr-reset-5rly.vercel.app/pay/TEST`,
                        ].join(' ');

                        const wa = buildWAUrl({ phone: phoneDigits, text });
                        window.open(wa, '_blank', 'noopener,noreferrer');
                      } catch {}
                    }}
                  >
                    Collect ₹
                  </button>
                </div>
              </div>

              {/* PREVIEW bubble */}
              <div
                className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap"
                data-test="nudge-preview"
                title="Preview of the message text that will be sent on WhatsApp"
              >
                {text}
              </div>
            </div>
          );
        })}
      </div>

      {/* === VYAPR: Batch Send (22.15) START === */}
      <Script id="vyapr-batch-send" strategy="afterInteractive">
        
         <Script id="vyapr-batch-send-guard" strategy="afterInteractive">
        {`
/**
 * VYAPR Guard (22.16): ensure button is interactable when allowed,
 * and also when cap is exhausted (so a click can log count:0).
 * No overrides of server state; just client affordances.
 */
(function(){
  try{
    if (window.__vyBatchGuard) return;
    window.__vyBatchGuard = true;

    const section = document.querySelector('[data-test="nudge-batch-ui"]');
    if(!section) return;

    const btn = section.querySelector('button');
    if(btn){
      btn.setAttribute('data-test','nudge-batch-send');
      btn.setAttribute('aria-label','Batch send WhatsApp nudges');
    }

    const total = Number(section.getAttribute('data-total')||'0');
    const remaining = Number(section.getAttribute('data-remaining')||'0');
    const isQuiet = section.getAttribute('data-isquiet') === '1';

    // Enable when allowed and items exist (normal happy path)
    if(btn && !isQuiet && remaining > 0 && total > 0){
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-50','cursor-not-allowed');
      if (!btn.textContent || /enable batch/i.test(btn.title||'')) {
        btn.textContent = 'Batch send';
        btn.title = 'Open WhatsApp for the allowed suggestions';
      }
    }

    /* === INSERT START (22.16: allow click to log when cap exhausted) === */
    // If cap is exhausted but there are items shown, enable the button so a click can log (0).
    if(btn && !isQuiet && remaining === 0 && total > 0){
      btn.removeAttribute('disabled');
      btn.classList.remove('opacity-50','cursor-not-allowed');
      btn.setAttribute('data-cap','exhausted');
      btn.title = 'Daily cap exhausted — click will log as (0)';
    }
    /* === INSERT END === */
  }catch(_){}
})();
        `}
      </Script>
        {`
(function(){
  try {
    const section = document.querySelector('[data-test="nudge-batch-ui"]');
    if(!section) return;
    const btn = section.querySelector('button');
    if(!btn) return;
    btn.id = 'vy-batch-btn';

    // read provider UUID from the root
    const rootEl = document.querySelector('[data-test="nudge-center-root"]');
    const providerId = rootEl ? rootEl.getAttribute('data-provider-id') : null;

    const total = Number(section.getAttribute('data-total')||'0');
    const remaining = Number(section.getAttribute('data-remaining')||'0');
    const isQuiet = section.getAttribute('data-isquiet') === '1';
    if(isQuiet || total <= 0) {
      // Still attach handler to allow logging (0) during quiet or no items
      // but don't attempt to open tabs.
    }

    const anchors = Array.from(document.querySelectorAll('[data-test="nudge-item"] a[data-test="nudge-send"]'));
    const allowed = Math.max(0, Math.min(remaining, anchors.length));

    async function logBatch(count){
      try{
        await fetch('/api/events/log', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            event: 'nudge.batch.sent',
            ts: Date.now(),
            provider_id: providerId,
            lead_id: null,
            source: { via: 'ui', count, window: (document.querySelector('[data-test="win-h24"].bg-black') ? 'h24' : 'd30') }
          })
        });
      }catch(_){}
    }

    // If there are zero sendable anchors, mark it so the title explains why.
    if(anchors.length === 0){
      btn.setAttribute('data-empty','1');
      if(!btn.hasAttribute('title')) {
        btn.title = 'No sendable WhatsApp numbers found in suggestions';
      }
    }

    btn.textContent = btn.textContent || 'Batch send';
    btn.addEventListener('click', async function(ev){
      ev.preventDefault();

      // Always log even if none sent (quiet/cap/no-anchors)
      if(isQuiet || allowed <= 0){
        await logBatch(0);
        btn.disabled = true;
        btn.textContent = 'Batch sent (0)';
        btn.title = btn.getAttribute('data-empty') === '1'
          ? 'No sendable WhatsApp numbers in this list'
          : (isQuiet ? 'Quiet hours active — sends paused' : 'Daily cap exhausted');
        return;
      }

      let opened = 0;
      for(let i=0;i<allowed;i++){
        const a = anchors[i];
        if(!a) break;
        const href = a.getAttribute('href');
        if(!href) continue;
        window.open(href, '_blank');
        opened++;
        await new Promise(r => setTimeout(r, 150));
      }
      logBatch(opened);
      btn.disabled = true;
      btn.textContent = 'Batch sent (' + opened + ')';
    }, { once: true });
  } catch(e){}
})();
        `}
      </Script>
      {/* === VYAPR: Batch Send (22.15) END === */}

      {/* === VYAPR: Batch Send Cap+Hint START (22.17) === */}
      <Script id="vyapr-batch-cap" strategy="afterInteractive">
        {`
(function(){
  try{
    // Hard cap for UI fan-out to avoid WA rate-limit spikes
    var CAP = 6;

    var section = document.querySelector('[data-test="nudge-batch-ui"]');
    if(!section) return;
    section.setAttribute('data-batch-cap', String(CAP));

    // Inject/update a small hint near the Batch button
    var btn = section.querySelector('button');
    if(btn){
      var hint = section.querySelector('[data-test="batch-hint"]');
      if(!hint){
        hint = document.createElement('small');
        hint.setAttribute('data-test','batch-hint');
        hint.style.display = 'block';
        hint.style.marginTop = '6px';
        hint.style.color = '#4b5563'; // gray-600
        btn.parentElement && btn.parentElement.appendChild(hint);
      }
      var total = Number(section.getAttribute('data-total')||'0');
      var remaining = Number(section.getAttribute('data-remaining')||'0');
      var allowed = Math.max(0, Math.min(remaining, total));
      var openN = Math.min(CAP, allowed);
      hint.textContent = 'Will open up to ' + openN + ' (cap ' + CAP + ')';
    }

    // Replace existing click handler with a capped version (no edits to earlier code)
    var oldBtn = section.querySelector('#vy-batch-btn');
    if(!oldBtn) return;

    var clone = oldBtn.cloneNode(true);
    oldBtn.replaceWith(clone);

    var rootEl = document.querySelector('[data-test="nudge-center-root"]');
    var providerId = rootEl ? rootEl.getAttribute('data-provider-id') : null;

    var anchors = Array.from(document.querySelectorAll('[data-test="nudge-item"] a[data-test="nudge-send"]'));
    var total = Number(section.getAttribute('data-total')||'0');
    var remaining = Number(section.getAttribute('data-remaining')||'0');
    var isQuiet = section.getAttribute('data-isquiet') === '1';
    var allowed = Math.max(0, Math.min(remaining, anchors.length));
    var openN = Math.min(CAP, allowed);

    async function logBatch(count){
      try{
        await fetch('/api/events/log', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            event:'nudge.batch.sent',
            ts: Date.now(),
            provider_id: providerId,
            lead_id: null,
            source:{ via:'ui', count: count, cap: CAP, window: (document.querySelector('[data-test="win-h24"].bg-black') ? 'h24' : 'd30') }
          })
        });
      }catch(_){}
    }

    clone.addEventListener('click', async function(ev){
      ev.preventDefault();

      // Respect quiet/cap
      if(isQuiet || openN <= 0){
        await logBatch(0);
        clone.disabled = true;
        clone.textContent = 'Batch sent (0)';
        return;
      }

      var opened = 0;
      for(var i=0;i<openN;i++){
        var a = anchors[i];
        if(!a) break;
        var href = a.getAttribute('href');
        if(!href) continue;
        window.open(href, '_blank', 'noopener,noreferrer');
        opened++;
        await new Promise(function(r){ setTimeout(r,150); });
      }
      await logBatch(opened);
      clone.disabled = true;
      clone.textContent = 'Batch sent ('+opened+')';
    }, { once:true });
  }catch(_){}
})();
        `}
      </Script>
      {/* === VYAPR: Batch Send Cap+Hint END (22.17) === */}
    </main>
  );
}
