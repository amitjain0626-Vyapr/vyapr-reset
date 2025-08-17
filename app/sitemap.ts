// app/sitemap.ts
// Minimal, App Router–safe sitemap generator.
// No dependency on pages-manifest.json or any build internals.

export default function sitemap() {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    "https://vyapr-reset-5rly.vercel.app";

  const now = new Date().toISOString();

  // Add any static routes you want indexed here
  const entries = [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${site}/onboarding`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/dashboard`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  return entries;
}
