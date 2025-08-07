import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p>Welcome, {session.user.email}</p>
    </div>
  )
}
