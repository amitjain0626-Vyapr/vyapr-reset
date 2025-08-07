import './globals.css'
import { createSupabaseServerClient } from './utils/supabase/server'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
