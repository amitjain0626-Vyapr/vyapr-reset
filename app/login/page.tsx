// app/login/page.tsx
// @ts-nocheck
import { sendMagicLink } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qp = await searchParams;
  const sent = qp?.sent === "1";
  const error = typeof qp?.error === "string" ? qp.error : undefined;
  const next = (typeof qp?.next === "string" ? qp.next : "/onboarding") || "/onboarding";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500">
        We’ll email you a one‑tap magic link.
      </p>

      {sent && (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Check your email for the magic link.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error === "email" ? "Please enter a valid email." : error}
        </div>
      )}

      <form action={sendMagicLink} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm text-gray-700">
          Email
          <input
            type="email"
            name="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-teal-600 px-4 py-2 text-white shadow hover:bg-teal-700"
        >
          Send magic link
        </button>
      </form>

      <div className="mt-6 text-xs text-gray-500">
        After sign‑in you’ll be redirected to: <code>{next}</code>
      </div>
    </div>
  );
}
