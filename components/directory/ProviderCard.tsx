// components/directory/ProviderCard.tsx
// @ts-nocheck
"use client";

import Link from "next/link";

type Props = {
  slug: string;
  display_name?: string | null;
  category?: string | null;
  location?: string | null;
  bio?: string | null;
  boosted?: boolean;
};

export default function ProviderCard({
  slug,
  display_name,
  category,
  location,
  bio,
  boosted,
}: Props) {
  return (
    <Link
      href={`/book/${slug}`}
      className="block rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow relative"
    >
      {boosted && (
        <span className="absolute top-2 right-2 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 border border-yellow-300">
          ⭐ Boost
        </span>
      )}
      <h2 className="text-lg font-medium">{display_name || slug}</h2>
      <p className="text-sm text-gray-600 mt-1">
        {[category, location].filter(Boolean).join(" — ")}
      </p>
      {bio ? (
        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{bio}</p>
      ) : null}
      <span className="inline-block mt-3 text-sm underline">Open profile →</span>
    </Link>
  );
}
