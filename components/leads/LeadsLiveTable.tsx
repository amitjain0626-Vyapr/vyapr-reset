// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import LeadsTable from '@/components/leads/LeadsTable';
import { createBrowserClient } from '@supabase/ssr';

type Lead = {
  id: string;
  patient_name: string;
  phone: string;
  note: string | null;
  status: string | null;
  source: any;
  created_at: string;
};

export default function LeadsLiveTable({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initial ?? []);
  const seenIdsRef = useRef<Set<string>>(new Set((initial ?? []).map((l) => l.id)));

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );

    let channelUI: ReturnType<typeof supabase.channel> | null = null;
    let channelLog: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // 1) Log current auth session
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id ?? null;
      // eslint-disable-next-line no-console
      console.log('[auth] session userId =', userId);

      if (cancelled) return;
      if (!userId) {
        // no session → nothing else to do (will explain next step based on this)
        return;
      }

      // 2) Subscribe for UI updates (guarded by provider_id)
      channelUI = supabase
        .channel('events:leads:ui')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'Events' }, // no server filter
          async (payload: any) => {
            // Log what we got
            // eslint-disable-next-line no-console
            console.log('[live:ui] payload provider_id=', payload?.new?.provider_id, 'expected=', userId);

            if (payload?.new?.provider_id !== userId) return;
            const newLeadId: string | undefined = payload?.new?.lead_id;
            if (!newLeadId) return;
            if (seenIdsRef.current.has(newLeadId)) return;

            try {
              const res = await fetch(`/api/leads/by-id?id=${encodeURIComponent(newLeadId)}`, { cache: 'no-store' });
              const json = await res.json();
              if (json?.ok && json.lead) {
                setLeads((prev) => {
                  if (prev.some((l) => l.id === newLeadId)) return prev;
                  seenIdsRef.current.add(newLeadId);
                  return [json.lead, ...prev];
                });
              }
            } catch {
              /* ignore */
            }
          }
        )
        .subscribe((status) => {
          // eslint-disable-next-line no-console
          console.log('[live:ui] channel status:', status);
        });

      // 3) Separate pure logger channel for ALL Events (helps isolate filter/session issues)
      channelLog = supabase
        .channel('events:leads:log')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'Events' }, // no server filter
          (payload: any) => {
            // eslint-disable-next-line no-console
            console.log('[live:log] received INSERT on Events:', payload?.new);
          }
        )
        .subscribe((status) => {
          // eslint-disable-next-line no-console
          console.log('[live:log] channel status:', status);
        });
    });

    return () => {
      cancelled = true;
      if (channelUI) channelUI.unsubscribe();
      if (channelLog) channelLog.unsubscribe();
    };
  }, []);

  return <LeadsTable leads={leads} />;
}
