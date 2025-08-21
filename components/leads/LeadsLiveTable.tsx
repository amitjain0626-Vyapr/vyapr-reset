// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // wait for logged-in user (owner) then subscribe
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
            const newLeadId = payload?.new?.lead_id as string | undefined;
            if (!newLeadId) return;

            // avoid duplicates
            if (leads.find((l) => l.id === newLeadId)) return;

            try {
              const res = await fetch(`/api/leads/by-id?id=${encodeURIComponent(newLeadId)}`);
              const json = await res.json();
              if (json?.ok && json.lead) {
                setLeads((prev) => [json.lead as Lead, ...prev]);
              }
            } catch (e) {
              // ignore network hiccups
              // eslint-disable-next-line no-console
              console.warn('live fetch failed', e);
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
  }, [leads]);

  return <LeadsTable leads={leads} />;
}
