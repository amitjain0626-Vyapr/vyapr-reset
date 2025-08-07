'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Required to disable static generation
export const dynamic = 'force-dynamic'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  useEffect(() => {
    const exchangeCode = async () => {
      if (!code) return

      const supabase = createClientComponentClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ Session exchange failed:', error.message)
        router.replace('/login?error=auth')
      } else {
        router.replace('/dashboard')
      }
    }

    exchangeCode()
  }, [code])

  return <p className="text-center mt-12">🔄 Logging you in...</p>
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="text-center mt-12">⏳ Redirecting...</p>}>
      <CallbackHandler />
    </Suspense>
  )
}
