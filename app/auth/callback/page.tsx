// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Callback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  useEffect(() => {
    const exchangeForSession = async () => {
      if (code) {
        const supabase = createClientComponentClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
          router.replace('/dashboard')
        } else {
          console.error('Session exchange error:', error.message)
          router.replace('/login?error=auth')
        }
      }
    }

    exchangeForSession()
  }, [code])

  return <p>Logging in via magic link...</p>
}
