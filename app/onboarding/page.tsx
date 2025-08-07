'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/utils/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      }
    })
  }, [])

  return <div className="p-4">🎉 Welcome to onboarding</div>
}
