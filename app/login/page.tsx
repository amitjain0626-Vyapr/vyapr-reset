'use client';

import { useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setMessage('Login failed. Try again.');
    } else {
      setMessage('Check your email for the magic link!');
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Login to Vyapr</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded w-full">
          Send Magic Link
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-center text-gray-600">{message}</p>}
    </div>
  );
}
