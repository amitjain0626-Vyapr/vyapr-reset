'use client';

// @ts-nocheck
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClientComponentClient();

  const handleLogin = async (e: any) => {
    e.preventDefault();

    const redirectTo = 'https://vyapr-reset-5rly-lfaa3pvlc-amit-jains-projects-88081448.vercel.app/auth/callback';
console.log('🔍 redirectTo HARDCODED:', redirectTo);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (!error) {
      setSubmitted(true);
    } else {
      alert('Login failed. Try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleLogin} className="space-y-4 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">Login</h1>
        {submitted ? (
          <p>Check your email for the login link.</p>
        ) : (
          <>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              required
            />
            <button
              type="submit"
              className="w-full bg-black text-white py-2 rounded"
            >
              Send Magic Link
            </button>
          </>
        )}
      </form>
    </div>
  );
}
