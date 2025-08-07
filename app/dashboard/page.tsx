import { createSupabaseServerClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Welcome, {session.user.email}</h1>
    </div>
  )
}
