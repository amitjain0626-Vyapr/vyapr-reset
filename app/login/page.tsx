'use client';

// @ts-nocheck
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();

    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
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
