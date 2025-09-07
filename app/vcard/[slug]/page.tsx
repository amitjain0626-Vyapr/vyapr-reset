// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: p } = await sb.from("Providers").select("display_name, whatsapp, phone").eq("slug", slug).maybeSingle();

  const wa = (() => {
    const raw = (p?.whatsapp || p?.phone || "").toString().replace(/[^\d+]/g, "");
    if (!raw) return "";
    const msg = encodeURIComponent(`Hi${p?.display_name ? " " + p.display_name : ""}, I'd like to book a slot: ${SITE}/book/${slug}`);
    return `https://wa.me/${raw.replace(/^\+/, "")}?text=${msg}`;
  })();

  const book = `${SITE}/book/${slug}`;

  return (
    <main className="mx-auto max-w-sm p-6 text-center space-y-4">
      <h1 className="text-xl font-semibold">{p?.display_name || slug}</h1>
      <img className="mx-auto w-48 h-48 border rounded-xl" src={`/api/qr?url=${encodeURIComponent(book)}`} alt="QR" />
      <div className="text-sm text-gray-700">Scan to book: <span className="font-mono">{book.replace(/^https?:\/\//, "")}</span></div>
      <div className="flex justify-center gap-3">
        <a href={book} className="rounded-full border px-4 py-2 text-sm">Open booking</a>
        <a href={wa || "#"} className={`rounded-full border px-4 py-2 text-sm ${wa ? "" : "opacity-50 pointer-events-none"}`} target="_blank">WhatsApp</a>
      </div>
    </main>
  );
}
