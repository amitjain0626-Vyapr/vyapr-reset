// @ts-nocheck
// components/EventsSubscriber.tsx
'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function EventsSubscriber() {
  useEffect(() => {
    // build once per mount; no async returns from effect
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unsubAuth: (() => void) | null = null;
    let cancelled = false;

    // wait for an authenticated user, then subscribe
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const userId = data?.user?.id;
      if (!userId) {
        // also listen if user logs in later (just in case)
        const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
          const uid = session?.user?.id;
          if (!uid || channel) return;
          channel = supabase
            .channel('events:leads')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'Events',
                filter: `provider_id=eq.${uid}`,
              },
              (payload) => {
                // eslint-disable-next-line no-console
                console.log('[realtime] lead event', payload);
              }
            )
            .subscribe((status) => {
              // eslint-disable-next-line no-console
              console.log('[realtime] channel status:', status);
            });
        });
        unsubAuth = () => sub.subscription.unsubscribe();
        return;
      }

      // user already present — subscribe immediately
      channel = supabase
        .channel('events:leads')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Events',
            filter: `provider_id=eq.${userId}`,
          },
          (payload) => {
            // eslint-disable-next-line no-console
            console.log('[realtime] lead event', payload);
          }
        )
        .subscribe((status) => {
          // eslint-disable-next-line no-console
          console.log('[realtime] channel status:', status);
        });
    });

    return () => {
      cancelled = true;
      if (channel) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        channel.unsubscribe();
      }
      if (unsubAuth) unsubAuth();
    };
  }, []);

  return null;
}
