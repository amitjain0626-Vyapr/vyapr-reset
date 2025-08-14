// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { bookRequestAction } from "./actions";
import ClientPayNow from "./ClientPayNow";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const qp = await searchParams;
  const slug = p.slug;

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, slug, category_slug")
    .eq("slug", slug)
    .single();

  if (!provider) return <div className="p-6">Provider not found.</div>;

  const ok = qp?.ok === "1";
  const paid = qp?.paid === "1";
  const err = typeof qp?.error === "string" ? qp.error : undefined;

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Book with {provider.name}</h1>
      <p className="text-gray-600 text-sm">Category: {provider.category_slug}</p>

      {paid && (
        <div className="rounded border p-3 text-sm">
          ✅ Payment received. We’ll confirm your slot shortly.
        </div>
      )}

      {ok && !paid && (
        <div className="rounded border p-3 text-sm">
          Thanks! Your request was sent. You can pay now to confirm your slot.
        </div>
      )}

      {err && (
        <div className="rounded border p-3 text-sm text-red-600">
          Something went wrong ({err}). Please try again.
        </div>
      )}

      {!ok && !paid && (
        <form action={bookRequestAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input name="name" placeholder="Your name" required className="w-full border p-3 rounded" />
          <input name="phone" placeholder="WhatsApp number" required className="w-full border p-3 rounded" />
          <input name="when" placeholder="Preferred date/time (e.g., Sat 5pm)" className="w-full border p-3 rounded" />
          <textarea name="note" placeholder="Anything we should know?" className="w-full border p-3 rounded" />
          <button type="submit" className="w-full bg-teal-600 text-white px-4 py-2 rounded">
            Request booking
          </button>
        </form>
      )}

      {ok && !paid && (
        <div className="pt-2">
          <ClientPayNow slug={slug} providerName={provider.name} />
        </div>
      )}
    </div>
  );
}
