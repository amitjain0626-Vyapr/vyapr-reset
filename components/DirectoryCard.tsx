// @ts-nocheck
import Link from "next/link";

export default function DirectoryCard({ p, city }: { p: any; city?: string }) {
  const name = p.display_name || p.slug;
  const wa = p.whatsapp || p.phone;
  const prefill = encodeURIComponent(`Hi ${name}, found you on Korekko. Can we chat?`);
  const waHref = wa ? `https://wa.me/${wa.replace(/\D/g, "")}?text=${prefill}` : undefined;

  return (
    <li className="rounded-2xl border p-4 hover:shadow-sm">
      <div className="text-base font-semibold">{name}</div>
      <div className="text-xs text-gray-500">{p.category} • {p.location || city}</div>
      {p.bio && <p className="text-sm mt-2 line-clamp-3">{p.bio}</p>}
      <div className="mt-3 flex gap-3">
        <Link href={`/book/${p.slug}`} className="inline-block rounded-xl bg-black text-white text-sm px-3 py-2">
          View profile
        </Link>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl border text-sm px-3 py-2">
            Chat on WhatsApp
          </a>
        )}
      </div>
    </li>
  );
}
