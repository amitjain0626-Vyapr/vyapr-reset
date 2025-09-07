// app/review/[slug]/ReviewLanding.tsx
// @ts-nocheck
"use client";

import * as React from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

export default function ReviewLanding({ slug }: { slug: string }) {
  const [stars, setStars] = React.useState<number | null>(null);
  const origin =
    (typeof window !== "undefined" && window.location?.origin) ||
    "https://vyapr-reset-5rly.vercel.app";

  React.useEffect(() => {
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "review.landing.open",
        ts: Date.now(),
        provider_id: null,
        lead_id: null,
        source: { via: "review.link", slug },
      }),
    }).catch(() => {});
  }, [slug]);

  function onRate(n: number) {
    setStars(n);
    fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "review.rating.selected",
        ts: Date.now(),
        provider_id: null,
        lead_id: null,
        source: { via: "review.link", slug, stars: n },
      }),
    }).catch(() => {});
  }

  const shareText =
    stars && stars >= 4
      ? `Loved the experience with ${slug}! ⭐️⭐️⭐️⭐️⭐️`
      : stars
      ? `Sharing feedback for ${slug}: ${"⭐".repeat(stars)}`
      : `My review for ${slug}:`;

  const waHref = `https://api.whatsapp.com/send?text=${encode(
    shareText + "\n\n(Write your feedback here…)"
  )}`;

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold">Thanks for choosing us!</h1>
        <p className="text-sm text-gray-600">
          Rate your experience in a tap and share your comments.
        </p>
      </header>

      {/* Stars */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onRate(n)}
            className={`h-10 w-10 rounded-full border text-lg ${
              stars && n <= stars
                ? "bg-yellow-100 border-yellow-300"
                : "hover:bg-gray-50"
            }`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ⭐
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="rounded-2xl border p-4">
        <p className="text-sm text-gray-700 mb-2">
          {stars
            ? `Selected: ${stars} star${stars > 1 ? "s" : ""}`
            : "Pick a star rating, then share:"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${shareText}\n\n(Write your feedback here…)`
              );
            }}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Copy text
          </button>
          <a
            href={waHref}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-500">
        Powered by Vyapr Reviews (MVP).{" "}
        <a href={origin} className="underline">
          Learn more
        </a>
      </footer>
    </main>
  );
}
