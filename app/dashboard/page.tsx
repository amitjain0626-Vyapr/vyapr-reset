'use client'

import { useSession } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!session) {
      router.push('/login')
    }
  }, [session])

  if (!session) return <p>Redirecting...</p>

  return (
    <div>
      <h1>Welcome, {session.user.email}</h1>
    </div>
  )
}
