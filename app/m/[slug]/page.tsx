// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supabaseAnon() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = supabaseAnon();
  const { data } = await supabase
    .from("Dentists")
    .select("name, city, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  const title = data?.name ? `${data.name} • ${data.city || "Dentist"}` : "Microsite";
  const description = data?.name
    ? `Book an appointment with ${data.name}${data.city ? ` in ${data.city}` : ""}.`
    : "Vyapr Microsite";

  return { title, description };
}

export default async function MicrositePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = supabaseAnon();
  const { data, error } = await supabase
    .from("Dentists")
    .select("name, slug, city, phone, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <div className="text-sm text-gray-600">
          {data.city ? `${data.city}` : ""}
          {data.city && data.phone ? " • " : ""}
          {data.phone || ""}
        </div>
      </header>

      {/* Intro */}
      <section className="rounded-2xl border p-5 space-y-3">
        <p className="text-sm">
          Public preview for <strong>{data.name}</strong>.
        </p>
        <div className="text-sm text-gray-600">
          Slug: <span className="font-mono">{data.slug}</span>
        </div>
        <div className="text-sm">Online booking and payments coming soon.</div>
      </section>

      {/* Call to action */}
      <section className="rounded-2xl border p-5 space-y-3">
        <h2 className="text-lg font-semibold">Ready to book?</h2>
        <p className="text-sm text-gray-600">
          Pick a time and leave your details. You’ll get a confirmation on WhatsApp/SMS.
        </p>
        <Link
          href={`/book/${data.slug}`}
          className="inline-block rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Book appointment
        </Link>
      </section>
    </main>
  );
}
