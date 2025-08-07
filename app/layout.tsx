// @ts-nocheck
import './globals.css'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient()

  return (
    <html lang="en">
      <body>
        <SessionContextProvider supabaseClient={supabase}>
          {children}
        </SessionContextProvider>
      </body>
    </html>
  )
}
