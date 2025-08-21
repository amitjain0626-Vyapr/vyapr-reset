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
  // Track which IDs we already have to avoid duplicates (and stale-closure bugs)
  const seenIdsRef = useRef<Set<string>>(new Set((initial ?? []).map((l) => l.id)));

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Subscribe ONCE; do NOT depend on `leads`
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data?.user?.id;
      if (!userId) return;

      channel = supabase
        .channel('events:leads:ui')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Events',
            filter: `provider_id=eq.${userId}`,
          },
          async (payload: any) => {
            const newLeadId: string | undefined = payload?.new?.lead_id;
            if (!newLeadId) return;

            // Dup guard using ref (not stale state)
            if (seenIdsRef.current.has(newLeadId)) {
              // console.log('[live] duplicate ignored', newLeadId);
              return;
            }

            try {
              const res = await fetch(`/api/leads/by-id?id=${encodeURIComponent(newLeadId)}`, {
                cache: 'no-store',
              });
              const json = await res.json();
              if (json?.ok && json.lead) {
                // Functional update so we never close over stale `leads`
                setLeads((prev) => {
                  // Final dup guard if multiple events land quickly
                  if (prev.some((l) => l.id === newLeadId)) return prev;
                  // remember this id
                  seenIdsRef.current.add(newLeadId);
                  // Prepend new lead
                  return [json.lead as Lead, ...prev];
                });
                // Optional: debug log
                // console.log('[live] prepended lead', newLeadId);
              }
            } catch (e) {
              // console.warn('[live] fetch failed', e);
            }
          }
        )
        .subscribe((status) => {
          // console.log('[realtime] ui channel status:', status);
        });
    });

    return () => {
      cancelled = true;
      if (channel) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        channel.unsubscribe();
      }
    };
    // []: subscribe only once
  }, []);

  return <LeadsTable leads={leads} />;
}
