// app/login/page.tsx
// @ts-nocheck
import { sendMagicLink } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 text-gray-600">We’ll email you a magic link to sign in.</p>
      <form action={sendMagicLink} className="space-y-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
          Send magic link
        </button>
      </form>
    </main>
  );
}
