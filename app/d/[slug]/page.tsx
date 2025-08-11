cat > app/d/[slug]/page.tsx <<'EOF'
// @ts-nocheck
// app/d/[slug]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "../../../lib/supabase/server";

type DentistRow = {
  id: string;
  slug?: string | null;
  name?: string | null;
  tagline?: string | null;
  bio?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  services?: string | string[] | null;
  photo_url?: string | null;
  cover_url?: string | null;
  website?: string | null;
  google_maps_link?: string | null;
  razorpay_link?: string | null;
  deleted_at?: string | null;
};

function normServices(s: any): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.map(x => String(x)).filter(Boolean).slice(0, 20);
  const txt = String(s);
  try {
    const maybe = JSON.parse(txt);
    if (Array.isArray(maybe)) return maybe.map(x => String(x)).filter(Boolean).slice(0, 20);
  } catch {}
  return txt.split(/[;,|]\s*/g).map(x => x.trim()).filter(Boolean).slice(0, 20);
}

async function loadDentist(slug: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("Dentists")
    .select("id,slug,name,tagline,bio,phone,whatsapp,address,city,services,photo_url,cover_url,website,google_maps_link,razorpay_link,deleted_at")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data || (data as DentistRow).deleted_at) return null;
  return data as DentistRow;
}

export default async function DentistPublicPage({ params }: { params: { slug: string } }) {
  const row = await loadDentist(params.slug);
  if (!row) notFound();

  const name = row.name ?? "Your Dentist";
  const tagline = row.tagline ?? "Dental care made simple";
  const services = normServices(row.services);
  const phone = row.phone ?? "";
  const wa = row.whatsapp ?? phone;
  const maps = row.google_maps_link ?? "";
  const pay = row.razorpay_link ?? "";

  return (
    <main className="min-h-screen">
      <div className="relative w-full h-48 md:h-64 bg-gray-100">
        {row.cover_url ? (
          <Image src={row.cover_url} alt={`${name} cover`} fill className="object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4">
          {row.photo_url ? (
            <Image src={row.photo_url} alt={`${name} photo`} width={80} height={80} className="rounded-2xl border bg-white" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white border grid place-items-center text-xl">🦷</div>
          )}
          <div className="text-white">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <p className="text-sm opacity-90">{tagline}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          {phone ? <a href={`tel:${phone}`} className="px-4 py-2 border rounded-xl hover:bg-gray-50">Call</a> : null}
          {wa ? <a href={`https://wa.me/${wa.replace(/[^\d]/g, "")}`} target="_blank" className="px-4 py-2 border rounded-xl hover:bg-gray-50">WhatsApp</a> : null}
          {maps ? <a href={maps} target="_blank" className="px-4 py-2 border rounded-xl hover:bg-gray-50">Directions</a> : null}
          {pay ? <a href={pay} target="_blank" className="px-4 py-2 border rounded-xl hover:bg-gray-50">Pay / Book</a> : null}
        </div>

        {(row.bio || row.address || row.city) ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About</h2>
            {row.bio ? <p className="text-sm leading-6">{row.bio}</p> : null}
            <p className="text-sm text-gray-600">
              {(row.address ?? "")} {row.city ? `• ${row.city}` : ""}
            </p>
          </section>
        ) : null}

        {services.length ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Services</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services.map((s, i) => <li key={i} className="px-3 py-2 border rounded-lg">{s}</li>)}
            </ul>
          </section>
        ) : null}

        <footer className="pt-6 text-xs text-gray-500">Powered by Vyapr • microsite</footer>
      </div>
    </main>
  );
}
EOF
