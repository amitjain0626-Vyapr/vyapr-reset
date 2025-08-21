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
  // Track IDs we already have (prevents duplicates + avoids stale-closure issues)
  const seenIdsRef = useRef<Set<string>>(new Set((initial ?? []).map((l) => l.id)));

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Subscribe ONCE (no deps)
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data?.user?.id;
      if (!userId) return;

      // Subscribe to ALL Events inserts (no server filter)
      channel = supabase
        .channel('events:leads:ui')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Events',
            // ⛔️ no filter here
          },
          async (payload: any) => {
            // ✅ Client-side guard to ensure only *my* events are processed
            if (payload?.new?.provider_id !== userId) return;

            const newLeadId: string | undefined = payload?.new?.lead_id;
            if (!newLeadId) return;

            // Dup guard using ref (not stale state)
            if (seenIdsRef.current.has(newLeadId)) return;

            try {
              const res = await fetch(`/api/leads/by-id?id=${encodeURIComponent(newLeadId)}`, {
                cache: 'no-store',
              });
              const json = await res.json();
              if (json?.ok && json.lead) {
                setLeads((prev) => {
                  if (prev.some((l) => l.id === newLeadId)) return prev;
                  seenIdsRef.current.add(newLeadId);
                  return [json.lead as Lead, ...prev]; // prepend
                });
              }
            } catch {
              // ignore transient network errors
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        channel.unsubscribe();
      }
    };
  }, []);

  return <LeadsTable leads={leads} />;
}
