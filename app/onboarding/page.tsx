'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/app/utils/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()

  async function handleSave() {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Save onboarding data...

    router.push('/dashboard')
  }

  return (
    <div>
      <h2>Onboarding</h2>
      <button onClick={handleSave}>Complete</button>
    </div>
  )
}
