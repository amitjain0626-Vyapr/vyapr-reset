'use client';
// @ts-nocheck

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

function CallbackLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error_description');

      if (errorParam) {
        console.error('Auth error:', errorParam);
        router.replace('/login');
        return;
      }

      if (!code) {
        router.replace('/login');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Session exchange failed:', exchangeError.message);
        router.replace('/login');
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('Dentists')
        .select('slug')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.slug) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    };

    handleAuth();
  }, [searchParams]);

  return (
    <div className="p-10 text-center text-gray-500">
      Verifying session...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">Loading callback...</div>}>
      <CallbackLogic />
    </Suspense>
  );
}
