'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')
  const [status, setStatus] = useState('Exchanging session...')

  useEffect(() => {
    const run = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      if (!code) {
        setStatus('No code found')
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ Supabase session error:', error.message)
        setStatus('Login failed')
        router.replace('/login?error=auth')
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('🟢 Supabase session set:', session)
        setStatus('Redirecting...')
        router.replace('/onboarding')
      }
    }

    run()
  }, [code])

  return <p className="text-center mt-12">{status}</p>
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">⏳ Logging in...</p>}>
      <CallbackHandler />
    </Suspense>
  )
}
