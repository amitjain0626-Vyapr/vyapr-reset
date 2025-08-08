// app/login/page.tsx
// @ts-nocheck
'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/app/utils/supabase/client'

export default function LoginPage() {
  const supabase = createSupabaseClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const redirect = `${window.location.origin}/auth/callback`

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    })

    setLoading(false)

    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      {sent ? (
        <p>Check your email for the magic link.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
