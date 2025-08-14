// @ts-nocheck
import { sendMagicLink } from "./actions";

/**
 * Next 15: searchParams must be awaited.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const qp = await searchParams; // ✅ await
  const sent = qp?.sent === "1";
  const error = typeof qp?.error === "string" ? qp.error : undefined;
  const next = (typeof qp?.next === "string" ? qp.next : "/onboarding") || "/onboarding";

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Login</h1>
      <p className="text-sm text-gray-600 mb-4">
        We’ll email you a magic link. Click it to continue.
      </p>

      {sent && (
        <div className="mb-4 rounded border p-3 text-sm">
          Check your email for the magic link. Keep this tab open.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded border p-3 text-sm text-red-600">
          {error === "email" ? "Please enter a valid email." : error}
        </div>
      )}

      <form action={sendMagicLink} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          className="w-full border p-3 rounded"
        />
        <button
          type="submit"
          className="w-full bg-teal-600 text-white px-4 py-2 rounded"
        >
          Send magic link
        </button>
      </form>
    </div>
  );
}
