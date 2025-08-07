// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/app/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient(cookieStore)
  const {
    data: { session }
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
