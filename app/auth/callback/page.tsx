// app/auth/callback/page.tsx
// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/app/utils/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
      if (error) {
        router.replace('/login')
        return
      }
      router.replace('/onboarding')
    }
    run()
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-base">Signing you in…</p>
    </div>
  )
}
