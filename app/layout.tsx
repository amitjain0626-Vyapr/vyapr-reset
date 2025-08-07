// app/layout.tsx
import './globals.css'
import { createSupabaseServerClient } from './utils/supabase/server'
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const supabase = createSupabaseServerClient(cookieStore)
  const {
    data: { session }
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
