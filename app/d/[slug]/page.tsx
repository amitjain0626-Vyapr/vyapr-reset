// @ts-nocheck
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const revalidate = 0;

export default async function MicrositePage({ params }: { params: { slug: string } }) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1) read microsite by slug (public)
  const { data: ms, error: msErr } = await supabase
    .from("microsites")
    .select("id, slug, is_live, provider_id, owner_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (msErr || !ms || !ms.is_live) return notFound();

  // 2) read provider basics (public-safe fields only)
  const { data: prov, error: pErr } = await supabase
    .from("providers")
    .select("id, name, phone, location, category")
    .eq("id", ms.provider_id)
    .maybeSingle();

  if (pErr || !prov) return notFound();

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-semibold">{prov.name}</h1>
      <p className="text-gray-600 mt-1">
        {prov.category} • {prov.location || "Near you"}
      </p>

      <div className="mt-6 flex gap-3">
        <a
          href={`/book/${ms.slug}`}
          className="rounded-md bg-black text-white px-4 py-2"
        >
          Book / Enquire
        </a>
        {prov.phone ? (
          <a
            href={`https://wa.me/${prov.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border px-4 py-2"
          >
            WhatsApp
          </a>
        ) : null}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-medium mb-2">About</h2>
        <p className="text-sm text-gray-700">
          Trusted {prov.category} provider. Book a slot or send a message—someone will get back to you shortly.
        </p>
      </section>
    </main>
  );
}
