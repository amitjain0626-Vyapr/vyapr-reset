'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  useEffect(() => {
    const run = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      if (!code) return

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.log('🔴 Supabase login error:', error.message)
        router.replace('/login?error=auth')
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('🟢 Supabase session set:', session)
        router.replace('/onboarding')
      }
    }

    run()
  }, [code])

  return <p className="text-center mt-12">🔐 Logging you in...</p>
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">⏳ Redirecting...</p>}>
      <CallbackHandler />
    </Suspense>
  )
}
