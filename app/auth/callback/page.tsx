'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  useEffect(() => {
    const exchangeCode = async () => {
      if (!code) return

      const supabase = createClientComponentClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Error exchanging code:', error.message)
        router.replace('/login?error=auth')
      } else {
        router.replace('/dashboard')
      }
    }

    exchangeCode()
  }, [code])

  return (
    <div className="p-4 text-center">
      <p>🔄 Logging you in...</p>
    </div>
  )
}
