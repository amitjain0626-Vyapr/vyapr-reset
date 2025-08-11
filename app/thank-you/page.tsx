// app/thank-you/page.tsx
// @ts-nocheck
import Link from "next/link";

export default function ThankYou(props: any) {
  const { searchParams } = (props || {}) as {
    searchParams?: Record<string, string | string[] | undefined>;
  };

  const slug =
    typeof searchParams?.slug === "string" ? searchParams.slug : "";

  return (
    <main className="max-w-3xl mx-auto p-6">
      <section className="rounded-3xl border bg-white shadow-sm p-8 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-sm text-gray-600 mt-2">
          Your request has been sent. The clinic will contact you shortly.
        </p>
        <div className="mt-6">
          {slug ? (
            <Link
              href={`/d/${slug}`}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
            >
              Back to microsite
            </Link>
          ) : (
            <Link
              href="/"
              className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
            >
              Go home
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
