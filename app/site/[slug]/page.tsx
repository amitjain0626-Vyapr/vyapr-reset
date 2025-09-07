// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function buildWaUrl({ phone, whatsapp, display_name, slug }: any) {
  const msg = `Hi${display_name ? " " + display_name : ""}, I'd like to book a slot via Vyapr (${SITE}/book/${slug}).`;
  const raw = (whatsapp || phone || "").toString().replace(/[^\d+]/g, "");
  return raw
    ? `https://wa.me/${raw.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
async function fetchVerification(slug: string) {
  try {
    const res = await fetch(`${SITE}/api/verification/status?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = await res.json();
    return !!j?.verified;
  } catch { return false; }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data } = await sb
    .from("Providers")
    .select("id, slug, display_name, bio, phone, whatsapp, category, location, services, published, image")
    .eq("slug", slug)
    .maybeSingle();

  const p = data || { slug, display_name: slug, published: false };
  const waUrl = buildWaUrl({ ...p, slug });
  const verified = await fetchVerification(slug);
  const services: Array<{ name: string; price?: number | string; desc?: string }> = Array.isArray(p?.services) ? p.services : [];

  const ogTitle = `${p?.display_name || p?.slug} — ${p?.category || "Services"} in ${p?.location || ""}`.trim();
  const ogDesc = p?.bio || "Book and pay easily with Vyapr.";
  const ogUrl = `${SITE}/site/${slug}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={ogUrl} />
        {p?.image ? <meta property="og:image" content={p.image} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
      </head>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            {p?.display_name || p?.slug}
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Verified by Vyapr
              </span>
            ) : null}
          </h1>
          <p className="text-gray-600 mt-1">{[p?.category, p?.location].filter(Boolean).join(" • ")}</p>
        </div>
        <a href={`/book/${slug}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm">
          Book now
        </a>
      </header>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Services</h2>
        {services.length ? (
          <ul className="space-y-3">
            {services.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{s?.name || "Service"}</div>
                  {s?.desc ? <div className="text-sm text-gray-600">{s.desc}</div> : null}
                </div>
                {s?.price ? <div className="text-sm text-gray-800">₹{s.price}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">Provider hasn’t added services yet.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">About</h2>
        <p className="text-gray-700 text-sm whitespace-pre-line">{p?.bio || "A brief about the provider will appear here."}</p>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Contact</h2>
        <div className="flex flex-wrap gap-3">
          {/* Always enabled via fallback composer */}
          <a href={waUrl} target="_blank" rel="noopener" className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-emerald-600 hover:shadow-sm">
            Chat on WhatsApp
          </a>
          <a href={`/book/${slug}`} className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm">
            Book a slot
          </a>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-3">Share</h2>
        <div className="flex items-center gap-4">
          <img alt="QR code" className="w-32 h-32 border rounded-lg" src={`/api/qr?url=${encodeURIComponent(`${SITE}/book/${slug}`)}`} />
          <div className="text-sm text-gray-700">
            Scan to book: <span className="font-mono">{SITE.replace(/^https?:\/\//, "")}/book/{slug}</span>
          </div>
        </div>
      </section>

      <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
        <ol className="flex gap-2">
          <li><Link className="hover:underline" href="/">Home</Link></li><li aria-hidden="true">/</li>
          <li><Link className="hover:underline" href="/directory">Directory</Link></li><li aria-hidden="true">/</li>
          <li className="text-gray-800">{p?.display_name || p?.slug}</li>
        </ol>
      </nav>
    </main>
  );
}
